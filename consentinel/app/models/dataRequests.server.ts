/**
 * DataRequest model layer: visitor-submitted privacy requests (DSAR) from
 * the storefront form at /apps/consentinel/privacy.
 *
 * This is the ONE table in the app that stores PII (email + free text), so:
 * - SHOP_REDACT purges it (webhooks.shop.redact.tsx)
 * - CUSTOMERS_REDACT deletes rows matching the customer's email
 *   (webhooks.customers.redact.tsx → deleteDataRequestsByEmail)
 * Inputs arrive from the public storefront, so validation here is strict and
 * abuse-limited; nothing a visitor types is ever reflected back into HTML.
 */
import type { DataRequest } from "@prisma/client";
import prisma from "../db.server";

export type { DataRequest };

export const DATA_REQUEST_TYPES = ["access", "deletion", "correction"] as const;
export type DataRequestType = (typeof DATA_REQUEST_TYPES)[number];

const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 120;
const MAX_ORDER_LENGTH = 60;
const MAX_MESSAGE_LENGTH = 2000;
// Public endpoint abuse valve: cap creations per shop per window. Legit
// stores see a handful of DSARs a week; anything past this is a bot.
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX_PER_WINDOW = 20;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type CreateDataRequestResult =
  | "created"
  | "duplicate"
  | "invalid"
  | "rate_limited";

export interface DataRequestInput {
  type: string;
  email: string;
  name: string;
  orderInfo: string;
  message: string;
}

export async function createDataRequest(
  shop: string,
  input: DataRequestInput,
): Promise<CreateDataRequestResult> {
  const type = input.type.trim();
  const email = input.email.trim().toLowerCase();
  if (!(DATA_REQUEST_TYPES as readonly string[]).includes(type)) return "invalid";
  if (
    email.length === 0 ||
    email.length > MAX_EMAIL_LENGTH ||
    !EMAIL_PATTERN.test(email)
  ) {
    return "invalid";
  }

  const since = new Date(Date.now() - RATE_WINDOW_MS);
  const recent = await prisma.dataRequest.count({
    where: { shop, createdAt: { gte: since } },
  });
  if (recent >= RATE_MAX_PER_WINDOW) return "rate_limited";

  // One open request per email+type: repeat submissions are acknowledged as
  // success to the visitor without creating inbox noise for the merchant.
  const existing = await prisma.dataRequest.findFirst({
    where: { shop, email, type, status: "open" },
    select: { id: true },
  });
  if (existing) return "duplicate";

  await prisma.dataRequest.create({
    data: {
      shop,
      type,
      email,
      name: input.name.trim().slice(0, MAX_NAME_LENGTH) || null,
      orderInfo: input.orderInfo.trim().slice(0, MAX_ORDER_LENGTH) || null,
      message: input.message.trim().slice(0, MAX_MESSAGE_LENGTH) || null,
    },
  });
  return "created";
}

export async function listDataRequests(shop: string): Promise<DataRequest[]> {
  return prisma.dataRequest.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}

export async function countOpenDataRequests(shop: string): Promise<number> {
  return prisma.dataRequest.count({ where: { shop, status: "open" } });
}

export async function setDataRequestStatus(
  shop: string,
  id: string,
  status: "open" | "resolved",
): Promise<void> {
  // updateMany so a forged id from another shop can never match.
  await prisma.dataRequest.updateMany({
    where: { id, shop },
    data: { status, resolvedAt: status === "resolved" ? new Date() : null },
  });
}

/** CUSTOMERS_REDACT: erase everything we hold for this customer's email. */
export async function deleteDataRequestsByEmail(
  shop: string,
  email: string,
): Promise<number> {
  const result = await prisma.dataRequest.deleteMany({
    where: { shop, email: email.trim().toLowerCase() },
  });
  return result.count;
}
