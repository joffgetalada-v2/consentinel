import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

/**
 * GDPR/CCPA mandatory webhook: erase a specific customer's personal data.
 * Consentinel stores no customer-identifiable data — ConsentEvent rows carry
 * no customer id, IP, or user agent, and the random visitorToken cannot be
 * correlated with the customer ids in this payload. With nothing to link a
 * customer to, there is nothing to redact; a 200 acknowledges completion.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(
    `Received ${topic} webhook for ${shop}: no customer-linked data stored, nothing to redact`,
  );

  return new Response();
};
