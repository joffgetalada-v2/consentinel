/**
 * APP_SUBSCRIPTIONS_UPDATE: keeps the cached plan on ShopSettings in sync the
 * moment a subscription changes (approved, cancelled from the Shopify admin,
 * declined charge, frozen billing) instead of waiting for the merchant to
 * open the app. The loader-time reconciliation in billing.server.ts stays as
 * the safety net for missed webhooks.
 */
import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { applySubscriptionUpdate } from "../models/billing.server";

interface SubscriptionPayload {
  app_subscription?: {
    admin_graphql_api_id?: string;
    status?: string;
  };
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const { payload, topic, shop, admin } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  const subscription = (payload as SubscriptionPayload).app_subscription;
  // No admin context happens when the shop uninstalled between the event and
  // delivery — nothing to sync then; the metafield dies with the install.
  if (!admin || !subscription?.status) return new Response();

  try {
    await applySubscriptionUpdate(
      admin,
      shop,
      subscription.status,
      subscription.admin_graphql_api_id ?? null,
    );
  } catch (error) {
    // Log and still 200: retrying won't fix a bad sync, and the app-open
    // reconciliation repairs the cache regardless.
    console.error(`Plan sync from ${topic} failed for ${shop}`, error);
  }
  return new Response();
};
