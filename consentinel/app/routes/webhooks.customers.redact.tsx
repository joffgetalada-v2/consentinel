import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { deleteDataRequestsByEmail } from "../models/dataRequests.server";

/**
 * GDPR/CCPA mandatory webhook: erase a specific customer's personal data.
 * The consent log stores no customer-identifiable data (no customer id, IP,
 * or user agent; visitorToken is random and uncorrelatable). The ONE place
 * PII can live is the DSAR inbox (DataRequest rows hold an email address) —
 * so those rows are deleted here when the payload identifies the customer.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload } = await authenticate.webhook(request);

  const email = (payload as { customer?: { email?: string } }).customer?.email;
  const deleted = email ? await deleteDataRequestsByEmail(shop, email) : 0;

  console.log(
    `Received ${topic} webhook for ${shop}: deleted ${deleted} data-request row(s); consent log stores no customer-linked data`,
  );

  return new Response();
};
