/**
 * Data requests inbox: visitor-submitted DSARs from the storefront form
 * (/apps/consentinel/privacy). Merchants resolve requests here; the app
 * never auto-responds — responding to a DSAR is the merchant's legal task,
 * this screen just makes sure nothing gets lost.
 */
import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import {
  listDataRequests,
  setDataRequestStatus,
} from "../models/dataRequests.server";

const TYPE_LABELS: Record<string, string> = {
  access: "Copy of data",
  deletion: "Delete data",
  correction: "Correct data",
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const requests = await listDataRequests(session.shop);
  return {
    formUrl: `https://${session.shop}/apps/consentinel/privacy`,
    requests: requests.map((row) => ({
      id: row.id,
      type: row.type,
      email: row.email,
      name: row.name,
      orderInfo: row.orderInfo,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const status = String(form.get("status") ?? "");
  if (!id || (status !== "open" && status !== "resolved")) {
    return { ok: false as const, message: "Invalid request" };
  }
  await setDataRequestStatus(session.shop, id, status);
  return {
    ok: true as const,
    message: status === "resolved" ? "Marked resolved" : "Reopened",
  };
};

export default function Requests() {
  const data = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const open = data.requests.filter((row) => row.status === "open");

  return (
    <s-page heading="Data requests">
      <s-section heading={open.length === 0 ? "No open requests" : `${open.length} open request${open.length === 1 ? "" : "s"}`}>
        {data.requests.length === 0 ? (
          <s-paragraph>
            When visitors submit a privacy request through your data-request
            page, it appears here. Nothing yet.
          </s-paragraph>
        ) : (
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>Received</s-table-header>
              <s-table-header>Request</s-table-header>
              <s-table-header>From</s-table-header>
              <s-table-header>Details</s-table-header>
              <s-table-header>Status</s-table-header>
              <s-table-header></s-table-header>
            </s-table-header-row>
            <s-table-body>
              {data.requests.map((row) => (
                <s-table-row key={row.id}>
                  <s-table-cell>
                    {new Date(row.createdAt).toLocaleDateString()}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={row.type === "deletion" ? "warning" : "info"}>
                      {TYPE_LABELS[row.type] ?? row.type}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    {row.name ? `${row.name} — ${row.email}` : row.email}
                  </s-table-cell>
                  <s-table-cell>
                    {[
                      row.orderInfo ? `Order: ${row.orderInfo}` : null,
                      row.message,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge tone={row.status === "open" ? "caution" : "success"}>
                      {row.status === "open" ? "Open" : "Resolved"}
                    </s-badge>
                  </s-table-cell>
                  <s-table-cell>
                    <s-button
                      onClick={() =>
                        fetcher.submit(
                          {
                            id: row.id,
                            status: row.status === "open" ? "resolved" : "open",
                          },
                          { method: "POST" },
                        )
                      }
                    >
                      {row.status === "open" ? "Mark resolved" : "Reopen"}
                    </s-button>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        )}
      </s-section>

      <s-section slot="aside" heading="Your data-request page">
        <s-paragraph>
          Visitors can submit privacy requests (GDPR/CCPA) at:
        </s-paragraph>
        <s-paragraph>
          <s-link href={data.formUrl} target="_blank">
            {data.formUrl}
          </s-link>
        </s-paragraph>
        <s-paragraph>
          <s-text color="subdued">
            Link it from your footer menu and privacy policy so it&apos;s easy
            to find. GDPR expects a response within 30 days; CCPA within 45.
            Requests are stored until you delete them and are erased
            automatically if a customer is redacted through Shopify.
          </s-text>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
