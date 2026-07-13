/**
 * ConsentEvent model layer: the merchant-facing consent audit log.
 *
 * Events are written by the storefront banner (via the app proxy endpoint,
 * built in step 5) and read by the admin log view. Records are PII-free by
 * design — see the schema comment on the ConsentEvent model.
 *
 * Phase 2 hooks: retention auto-purge and DSAR export would live here.
 */
import type { ConsentEvent } from "@prisma/client";
import prisma from "../db.server";
import {
  type ConsentCategories,
  isConsentAction,
  isConsentMode,
} from "../types/consent";

export type { ConsentEvent };

const MAX_TOKEN_LENGTH = 64;
const MAX_REGION_LENGTH = 16;

export interface ConsentEventInput {
  region?: string | null;
  mode: string;
  action: string;
  categories: ConsentCategories;
  saleOfDataOptedOut?: boolean | null;
  visitorToken?: string | null;
}

/**
 * Records one consent decision. Input arrives from the public storefront, so
 * everything is treated as hostile: enums are checked, free-text fields are
 * length-capped, and anything unexpected is dropped rather than stored.
 */
export async function recordConsentEvent(
  shop: string,
  input: ConsentEventInput,
): Promise<ConsentEvent> {
  if (!isConsentMode(input.mode) || !isConsentAction(input.action)) {
    throw new Response("Invalid consent event", { status: 400 });
  }

  const region =
    typeof input.region === "string" && input.region.length <= MAX_REGION_LENGTH
      ? input.region
      : null;
  const visitorToken =
    typeof input.visitorToken === "string" &&
    input.visitorToken.length <= MAX_TOKEN_LENGTH
      ? input.visitorToken
      : null;

  return prisma.consentEvent.create({
    data: {
      shop,
      region,
      mode: input.mode,
      action: input.action,
      preferences: Boolean(input.categories.preferences),
      analytics: Boolean(input.categories.analytics),
      marketing: Boolean(input.categories.marketing),
      saleOfDataOptedOut: input.saleOfDataOptedOut ?? null,
      visitorToken,
    },
  });
}

export interface ConsentEventPage {
  events: ConsentEvent[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
}

/** Newest-first page of the log for the admin view. */
export async function listConsentEvents(
  shop: string,
  { page = 1, pageSize = 50 }: { page?: number; pageSize?: number } = {},
): Promise<ConsentEventPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(250, Math.max(1, Math.floor(pageSize)));

  const [events, totalCount] = await prisma.$transaction([
    prisma.consentEvent.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
    prisma.consentEvent.count({ where: { shop } }),
  ]);

  return {
    events,
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    hasNextPage: safePage * safePageSize < totalCount,
  };
}
