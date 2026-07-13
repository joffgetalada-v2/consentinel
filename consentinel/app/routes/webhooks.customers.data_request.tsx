import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR/CCPA mandatory webhook: a customer asked the merchant for a copy of
 * their personal data (DSAR). Consentinel stores no customer-identifiable
 * data by design — ConsentEvent rows are PII-free (no IP, no user agent, no
 * customer id; visitorToken is a random client-side token that cannot be
 * mapped to a customer). There is therefore nothing to export; acknowledging
 * with a 200 completes our obligation. authenticate.webhook rejects invalid
 * HMACs with a 401, which Shopify's automated review checks for.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const dataRequestId = (payload as { data_request?: { id?: number } })
    .data_request?.id;
  console.log(
    `Received ${topic} webhook for ${shop} (data_request ${dataRequestId ?? "unknown"}): no customer PII stored, nothing to export`,
  );

  return new Response();
};
