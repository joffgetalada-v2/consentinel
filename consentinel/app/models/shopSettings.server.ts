/**
 * ShopSettings model layer: per-shop banner configuration and plan state.
 *
 * Settings rows are created lazily with schema defaults the first time a
 * shop is seen, so callers never handle a "no settings yet" case.
 */
import type { ShopSettings } from "@prisma/client";
import prisma from "../db.server";
import {
  isBannerPosition,
  isHexColor,
  isPolicyUrl,
  isThemePreset,
} from "../types/consent";

export type { ShopSettings };

const MAX_LABEL_LENGTH = 60;
const MAX_HEADING_LENGTH = 120;
const MAX_BODY_LENGTH = 1000;

export async function getShopSettings(shop: string): Promise<ShopSettings> {
  return prisma.shopSettings.upsert({
    where: { shop },
    update: {},
    create: { shop },
  });
}

/** Fields a merchant may edit from the admin UI. Billing fields are excluded
 * on purpose — those change only through the billing flow (step 7). */
export interface ShopSettingsInput {
  heading?: string;
  body?: string;
  acceptLabel?: string;
  rejectLabel?: string;
  customizeLabel?: string;
  privacyPolicyUrl?: string | null;
  position?: string;
  themePreset?: string;
  accentColor?: string;
  onboardingDismissed?: boolean;
}

export interface SettingsValidationError {
  field: keyof ShopSettingsInput;
  message: string;
}

/**
 * Validates merchant input. Returns errors rather than throwing so the admin
 * UI can surface them inline next to the offending Polaris field.
 */
export function validateShopSettingsInput(
  input: ShopSettingsInput,
): SettingsValidationError[] {
  const errors: SettingsValidationError[] = [];

  const requireLength = (
    field: keyof ShopSettingsInput,
    value: string,
    max: number,
  ) => {
    if (value.trim().length === 0) {
      errors.push({ field, message: "Can't be empty" });
    } else if (value.length > max) {
      errors.push({ field, message: `Must be ${max} characters or fewer` });
    }
  };

  if (input.heading !== undefined) requireLength("heading", input.heading, MAX_HEADING_LENGTH);
  if (input.body !== undefined) requireLength("body", input.body, MAX_BODY_LENGTH);
  if (input.acceptLabel !== undefined) requireLength("acceptLabel", input.acceptLabel, MAX_LABEL_LENGTH);
  if (input.rejectLabel !== undefined) requireLength("rejectLabel", input.rejectLabel, MAX_LABEL_LENGTH);
  if (input.customizeLabel !== undefined) requireLength("customizeLabel", input.customizeLabel, MAX_LABEL_LENGTH);

  if (
    input.privacyPolicyUrl !== undefined &&
    input.privacyPolicyUrl !== null &&
    input.privacyPolicyUrl !== "" &&
    !isPolicyUrl(input.privacyPolicyUrl)
  ) {
    errors.push({
      field: "privacyPolicyUrl",
      message: "Enter a full URL (https://…) or a store path like /policies/privacy-policy",
    });
  }

  if (input.position !== undefined && !isBannerPosition(input.position)) {
    errors.push({ field: "position", message: "Unknown banner position" });
  }
  if (input.themePreset !== undefined && !isThemePreset(input.themePreset)) {
    errors.push({ field: "themePreset", message: "Unknown theme preset" });
  }
  if (input.accentColor !== undefined && !isHexColor(input.accentColor)) {
    errors.push({ field: "accentColor", message: "Enter a hex color like #1A1A1A" });
  }

  return errors;
}

/**
 * Branding is deliberately not part of ShopSettingsInput: it may only change
 * through the plan page, which verifies the shop is on the paid plan first
 * (see app/models/billing.server.ts canRemoveBranding).
 */
export async function updateShowBranding(
  shop: string,
  showBranding: boolean,
): Promise<ShopSettings> {
  await getShopSettings(shop); // ensure the row exists
  return prisma.shopSettings.update({
    where: { shop },
    data: { showBranding },
  });
}

/** Persists a validated update. Callers must run validateShopSettingsInput first. */
export async function updateShopSettings(
  shop: string,
  input: ShopSettingsInput,
): Promise<ShopSettings> {
  // Normalize empty policy URL to null so the storefront gets one falsy shape.
  const privacyPolicyUrl =
    input.privacyPolicyUrl === "" ? null : input.privacyPolicyUrl;

  await getShopSettings(shop); // ensure the row exists
  return prisma.shopSettings.update({
    where: { shop },
    data: { ...input, privacyPolicyUrl },
  });
}
