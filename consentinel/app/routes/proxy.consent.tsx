/**
 * App proxy endpoint for consent-event logging.
 *
 * The storefront banner POSTs here via /apps/consentinel/consent (see the
 * [app_proxy] block in shopify.app.toml). authenticate.public.appProxy
 * verifies Shopify's HMAC signature, which also tells us which shop the
 * event belongs to — the client can't spoof another shop.
 *
 * Input is anonymous visitor data; the model layer enforces the PII-free
 * shape and drops anything malformed.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { recordConsentEvent } from "../models/consentEvents.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    // Signature valid but app not installed on this shop — nothing to record.
    return new Response(null, { status: 204 });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const body = payload as {
    mode?: string;
    action?: string;
    categories?: { preferences?: boolean; analytics?: boolean; marketing?: boolean };
    saleOfDataOptedOut?: boolean | null;
    visitorToken?: string | null;
    region?: string | null;
  };

  await recordConsentEvent(session.shop, {
    mode: String(body.mode ?? ""),
    action: String(body.action ?? ""),
    categories: {
      preferences: Boolean(body.categories?.preferences),
      analytics: Boolean(body.categories?.analytics),
      marketing: Boolean(body.categories?.marketing),
    },
    saleOfDataOptedOut:
      typeof body.saleOfDataOptedOut === "boolean" ? body.saleOfDataOptedOut : null,
    visitorToken: typeof body.visitorToken === "string" ? body.visitorToken : null,
    region: typeof body.region === "string" ? body.region : null,
  });

  return new Response(null, { status: 204 });
};
