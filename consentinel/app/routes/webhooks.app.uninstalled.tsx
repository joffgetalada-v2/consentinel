import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  // Only sessions are deleted here — settings, region rules, and the consent
  // audit log survive the 48-hour reinstall window and are purged by the
  // mandatory SHOP_REDACT webhook (webhooks.shop.redact.tsx).
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
