/**
 * Billing model layer: reconciles the cached plan on ShopSettings with the
 * Billing API, and centralizes the free-vs-paid gating policy.
 *
 * The Billing API is the source of truth; ShopSettings.plan exists only so
 * gating checks don't cost an Admin API call. syncPlanFromBilling re-verifies
 * the subscription and repairs the cache — it runs on the app home and plan
 * page loaders, so expired trials and externally-cancelled subscriptions
 * downgrade the next time the merchant opens the app.
 */
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import type { ShopSettings } from "@prisma/client";
import prisma from "../db.server";
import { BILLING_TEST_MODE, PRO_PLAN } from "../shopify.server";
import { getShopSettings } from "./shopSettings.server";
import { syncStorefrontConfig } from "./storefrontConfig.server";

/**
 * Structural slice of the library's billing context. Method syntax on
 * purpose: it keeps the parameter check bivariant so the real (generic)
 * context is assignable without dragging the app-config generics in here.
 */
export interface BillingChecker {
  check(options: { plans: (typeof PRO_PLAN)[]; isTest: boolean }): Promise<{
    hasActivePayment: boolean;
    appSubscriptions: { id: string; name: string }[];
  }>;
}

// ---------------------------------------------------------------------------
// Gating policy (the one place plan differences are defined)
// ---------------------------------------------------------------------------

/**
 * Free plan ships the fully compliant defaults everywhere; customizing
 * region rules (changing consent model, disabling regions) is Pro. This is
 * deliberately NOT "free = 1 enabled region": all 10 region groups seed
 * enabled so a fresh install is compliant, and a plan limit must never force
 * a merchant to switch off a legally required banner.
 */
export function canEditRegionRules(plan: string): boolean {
  return plan === "paid";
}

/** The "Powered by Consentinel" credit is removable on Pro only. */
export function canRemoveBranding(plan: string): boolean {
  return plan === "paid";
}

/** Showing the merchant's own logo on the banner is Pro only. */
export function canUseLogo(plan: string): boolean {
  return plan === "paid";
}

/** Advanced styling (banner width, fonts, border thickness) is Pro only. */
export function canUseAdvancedStyling(plan: string): boolean {
  return plan === "paid";
}

/** One-click cookie-policy page generation from scan results is Pro only. */
export function canGeneratePolicy(plan: string): boolean {
  return plan === "paid";
}

// ---------------------------------------------------------------------------
// Plan cache reconciliation
// ---------------------------------------------------------------------------

/**
 * Applies an APP_SUBSCRIPTIONS_UPDATE webhook to the plan cache. Mirrors
 * syncPlanFromBilling but trusts the webhook payload instead of calling
 * billing.check (webhook contexts have no billing helper). PENDING means the
 * merchant hasn't approved the charge yet — the cache must not change.
 */
export async function applySubscriptionUpdate(
  admin: AdminApiContext,
  shop: string,
  subscriptionStatus: string,
  subscriptionGid: string | null,
): Promise<void> {
  if (subscriptionStatus === "PENDING") return;

  const settings = await getShopSettings(shop);
  const plan = subscriptionStatus === "ACTIVE" ? "paid" : "free";
  const subscriptionId = plan === "paid" ? subscriptionGid : null;
  // Same downgrade rule as syncPlanFromBilling: leaving the paid plan
  // forcibly restores the "Powered by" credit.
  const showBranding = plan === "paid" ? settings.showBranding : true;

  if (
    settings.plan === plan &&
    settings.subscriptionId === subscriptionId &&
    settings.showBranding === showBranding
  ) {
    return;
  }

  await prisma.shopSettings.update({
    where: { shop },
    data: { plan, subscriptionId, showBranding },
  });
  await syncStorefrontConfig(admin, shop);
}

export async function syncPlanFromBilling(
  billing: BillingChecker,
  admin: AdminApiContext,
  shop: string,
): Promise<ShopSettings> {
  const settings = await getShopSettings(shop);
  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [PRO_PLAN],
    isTest: BILLING_TEST_MODE,
  });

  const plan = hasActivePayment ? "paid" : "free";
  const subscriptionId = hasActivePayment
    ? (appSubscriptions[0]?.id ?? null)
    : null;
  // Branding removal is a paid perk: any downgrade (cancellation, declined
  // charge, expired trial) forcibly restores the credit.
  const showBranding = plan === "paid" ? settings.showBranding : true;

  if (
    settings.plan === plan &&
    settings.subscriptionId === subscriptionId &&
    settings.showBranding === showBranding
  ) {
    return settings;
  }

  const updated = await prisma.shopSettings.update({
    where: { shop },
    data: { plan, subscriptionId, showBranding },
  });
  // Plan changes can change the storefront banner (branding), so re-sync.
  await syncStorefrontConfig(admin, shop);
  return updated;
}
