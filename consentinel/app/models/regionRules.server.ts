/**
 * RegionRule model layer: which consent model (opt-in vs opt-out) applies to
 * visitors from each region group.
 *
 * Rules are seeded from REGION_GROUPS defaults on first read, so a fresh
 * install is immediately compliant-by-default (EU/UK opt-in, US states
 * opt-out) before the merchant touches anything.
 */
import type { RegionRule } from "@prisma/client";
import prisma from "../db.server";
import { REGION_GROUPS, isConsentMode } from "../types/consent";

export type { RegionRule };

export async function getRegionRules(shop: string): Promise<RegionRule[]> {
  const existing = await prisma.regionRule.findMany({
    where: { shop },
    orderBy: { region: "asc" },
  });
  if (existing.length > 0) return existing;

  // First read for this shop: seed the defaults in one transaction.
  // createMany + re-read keeps this idempotent under concurrent first loads
  // (the unique [shop, region] constraint makes duplicates impossible).
  await prisma.regionRule.createMany({
    data: REGION_GROUPS.map((group) => ({
      shop,
      region: group.code,
      mode: group.defaultMode,
      enabled: group.defaultEnabled,
    })),
  });
  return prisma.regionRule.findMany({
    where: { shop },
    orderBy: { region: "asc" },
  });
}

export interface RegionRuleUpdate {
  region: string;
  mode?: string;
  enabled?: boolean;
}

/**
 * Updates one region rule. Unknown regions and invalid modes are rejected —
 * region codes come from our own REGION_GROUPS list, so anything else is a
 * malformed request, not merchant input worth an inline error.
 */
export async function updateRegionRule(
  shop: string,
  update: RegionRuleUpdate,
): Promise<RegionRule> {
  const known = REGION_GROUPS.some((group) => group.code === update.region);
  if (!known) {
    throw new Response(`Unknown region "${update.region}"`, { status: 400 });
  }
  if (update.mode !== undefined && !isConsentMode(update.mode)) {
    throw new Response(`Unknown consent mode "${update.mode}"`, { status: 400 });
  }

  await getRegionRules(shop); // ensure defaults are seeded
  return prisma.regionRule.update({
    where: { shop_region: { shop, region: update.region } },
    data: {
      ...(update.mode !== undefined ? { mode: update.mode } : {}),
      ...(update.enabled !== undefined ? { enabled: update.enabled } : {}),
    },
  });
}
