/**
 * Read-only consent log: the merchant's audit trail of consent decisions.
 * Populated by the storefront banner (step 5); paginated newest-first.
 */
import { useState } from "react";
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { listConsentEvents } from "../models/consentEvents.server";
import { getShopSettings } from "../models/shopSettings.server";
import { REGION_GROUPS } from "../types/consent";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") ?? "1") || 1;
  const [result, settings] = await Promise.all([
    listConsentEvents(session.shop, { page, pageSize: 50 }),
    getShopSettings(session.shop),
  ]);
  return { result, canExport: settings.plan === "paid" };
};

const ACTION_LABELS: Record<string, { label: string; tone: "success" | "critical" | "info" | "warning" }> = {
  accept_all: { label: "Accepted all", tone: "success" },
  reject_all: { label: "Rejected all", tone: "critical" },
  custom: { label: "Custom", tone: "info" },
  sale_opt_out: { label: "Do Not Sell/Share", tone: "warning" },
};

export default function ConsentLog() {
  const { result, canExport } = useLoaderData<typeof loader>();
  const [, setSearchParams] = useSearchParams();
  const shopify = useAppBridge();
  const [exporting, setExporting] = useState(false);

  // App Bridge attaches the session token to fetch(), so the CSV comes back
  // as an authenticated response we can hand to the browser as a download.
  const exportCsv = async () => {
    setExporting(true);
    try {
      const response = await fetch("/app/log.csv");
      if (!response.ok) {
        shopify.toast.show(
          response.status === 403
            ? "CSV export is a Pro feature — upgrade on the Plan page"
            : "Export failed — try again",
          { isError: true },
        );
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "consent-log.csv";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      shopify.toast.show("Export failed — try again", { isError: true });
    } finally {
      setExporting(false);
    }
  };

  const regionLabel = (code: string | null) =>
    code
      ? (REGION_GROUPS.find((group) => group.code === code)?.label ?? code)
      : "Unknown";

  const categorySummary = (event: (typeof result.events)[number]) => {
    const granted = [
      event.preferences ? "Preferences" : null,
      event.analytics ? "Analytics" : null,
      event.marketing ? "Marketing" : null,
    ].filter(Boolean);
    return granted.length > 0 ? granted.join(", ") : "Necessary only";
  };

  return (
    <s-page heading="Consent log">
      {result.totalCount === 0 ? (
        <s-section>
          <s-banner tone="info" heading="No consent events yet">
            <s-paragraph>
              Events appear here as soon as visitors interact with the consent
              banner on your storefront. Activate the app embed from the Home
              screen if you haven&apos;t yet.
            </s-paragraph>
          </s-banner>
        </s-section>
      ) : (
        <s-section>
          <s-stack direction="inline" gap="base">
            <s-paragraph>
              <s-text color="subdued">
                {result.totalCount} recorded decision
                {result.totalCount === 1 ? "" : "s"}. Records contain no
                personally identifiable information.
              </s-text>
            </s-paragraph>
            <s-button
              onClick={exportCsv}
              {...(exporting ? { loading: true } : {})}
              {...(!canExport ? { disabled: true } : {})}
            >
              {canExport ? "Export CSV" : "Export CSV (Pro)"}
            </s-button>
          </s-stack>
          <s-table variant="auto">
            <s-table-header-row>
              <s-table-header>Time (UTC)</s-table-header>
              <s-table-header>Region</s-table-header>
              <s-table-header>Decision</s-table-header>
              <s-table-header>Categories granted</s-table-header>
              <s-table-header>Sale of data</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {result.events.map((event) => {
                const action = ACTION_LABELS[event.action] ?? {
                  label: event.action,
                  tone: "info" as const,
                };
                return (
                  <s-table-row key={event.id}>
                    <s-table-cell>
                      {new Date(event.createdAt).toISOString().replace("T", " ").slice(0, 19)}
                    </s-table-cell>
                    <s-table-cell>{regionLabel(event.region)}</s-table-cell>
                    <s-table-cell>
                      <s-badge tone={action.tone}>{action.label}</s-badge>
                    </s-table-cell>
                    <s-table-cell>{categorySummary(event)}</s-table-cell>
                    <s-table-cell>
                      {event.saleOfDataOptedOut === null
                        ? "—"
                        : event.saleOfDataOptedOut
                          ? "Opted out"
                          : "Allowed"}
                    </s-table-cell>
                  </s-table-row>
                );
              })}
            </s-table-body>
          </s-table>
          <s-stack direction="inline" gap="base">
            <s-button
              disabled={result.page <= 1}
              onClick={() => setSearchParams({ page: String(result.page - 1) })}
            >
              Previous
            </s-button>
            <s-button
              disabled={!result.hasNextPage}
              onClick={() => setSearchParams({ page: String(result.page + 1) })}
            >
              Next
            </s-button>
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
