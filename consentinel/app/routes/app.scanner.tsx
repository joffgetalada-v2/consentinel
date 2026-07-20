/**
 * Cookie scanner screen: runs the server-side tracker scan (see
 * app/models/scanner.server.ts) and reports what the store loads, grouped by
 * how Consentinel handles each service before consent.
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
  getLatestScan,
  runScan,
  type TrackerFinding,
} from "../models/scanner.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  return { scan: await getLatestScan(session.shop) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const report = await runScan(admin, session.shop);
  if (report.status === "failed") {
    return { ok: false as const, message: report.error ?? "Scan failed" };
  }
  const count = report.findings.length;
  return {
    ok: true as const,
    message:
      count === 0
        ? "Scan complete — no third-party trackers found"
        : `Scan complete — ${count} third-party service${count === 1 ? "" : "s"} found`,
  };
};

const HANDLING_GROUPS = [
  {
    handling: "blocked",
    heading: "Held until consent",
    tone: "success" as const,
    badge: "Blocked pre-consent",
    description:
      "Consentinel's script blocker keeps these from loading until the visitor consents to their category.",
  },
  {
    handling: "consent_mode",
    heading: "Managed by Google Consent Mode v2",
    tone: "info" as const,
    badge: "Consent Mode",
    description:
      "Google tags load but honor denied-by-default Consent Mode signals until the visitor accepts — Google's supported mechanism, which also preserves conversion modeling.",
  },
  {
    handling: "visible",
    heading: "Detected — review recommended",
    tone: "warning" as const,
    badge: "Review",
    description:
      "These load outside the current blocker list. Many respect consent on their own; for custom scripts you can opt them in explicitly with " +
      'type="text/consentinel" data-category="analytics" on the script tag.',
  },
];

export default function Scanner() {
  const { scan } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isScanning = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      shopify.toast.show(fetcher.data.message, { isError: !fetcher.data.ok });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const findings = scan?.findings ?? [];
  const nonEssential = findings.filter(
    (finding) => finding.category !== "essential",
  );

  return (
    <s-page heading="Cookie scanner">
      <s-section heading="Scan your store">
        <s-stack direction="block" gap="base">
          <s-paragraph>
            The scanner reads your storefront and theme code, and reports the
            third-party tracking services it finds — and what Consentinel does
            with each one before a visitor consents.
          </s-paragraph>
          <s-stack direction="inline" gap="base">
            <s-button
              variant="primary"
              onClick={() => fetcher.submit({}, { method: "POST" })}
              {...(isScanning ? { loading: true } : {})}
            >
              {scan ? "Scan again" : "Scan my store"}
            </s-button>
            {scan?.completedAt && (
              <s-text color="subdued">
                Last scan: {new Date(scan.completedAt).toLocaleString()}
              </s-text>
            )}
          </s-stack>
          {isScanning && (
            <s-paragraph>
              <s-text color="subdued">
                Scanning your storefront and theme — this takes a few seconds…
              </s-text>
            </s-paragraph>
          )}
        </s-stack>
      </s-section>

      {scan && scan.status === "failed" && (
        <s-section heading="Scan failed">
          <s-paragraph>{scan.error}</s-paragraph>
        </s-section>
      )}

      {scan && scan.status === "completed" && (
        <s-section
          heading={
            nonEssential.length === 0
              ? "No third-party trackers found"
              : `${nonEssential.length} third-party service${nonEssential.length === 1 ? "" : "s"} found`
          }
        >
          <s-stack direction="block" gap="base">
            {!scan.storefrontAccessible && (
              <s-paragraph>
                <s-text color="subdued">
                  Your online store is password-protected, so the rendered
                  pages couldn&apos;t be fetched — these results come from your
                  theme code and app embeds. Run the scan again once the store
                  is public for full coverage.
                </s-text>
              </s-paragraph>
            )}
            {scan.pagesScanned.length > 0 && (
              <s-paragraph>
                <s-text color="subdued">
                  Scanned: {scan.pagesScanned.join(", ")}
                </s-text>
              </s-paragraph>
            )}
            {findings.length === 0 ? (
              <s-paragraph>
                Nothing beyond Shopify&apos;s own platform scripts was detected.
                As you install marketing or analytics apps, re-run the scan to
                see how they&apos;re handled.
              </s-paragraph>
            ) : (
              HANDLING_GROUPS.map((group) => {
                const groupFindings = findings.filter(
                  (finding) => finding.handling === group.handling,
                );
                if (groupFindings.length === 0) return null;
                return (
                  <s-box
                    key={group.handling}
                    padding="base"
                    borderWidth="base"
                    borderRadius="base"
                  >
                    <s-stack direction="block" gap="small-200">
                      <s-heading>{group.heading}</s-heading>
                      <s-paragraph>
                        <s-text color="subdued">{group.description}</s-text>
                      </s-paragraph>
                      {groupFindings.map((finding) => (
                        <FindingRow
                          key={finding.service}
                          finding={finding}
                          tone={group.tone}
                          badge={group.badge}
                        />
                      ))}
                    </s-stack>
                  </s-box>
                );
              })
            )}
          </s-stack>
        </s-section>
      )}

      <s-section slot="aside" heading="How the scan works">
        <s-unordered-list>
          <s-list-item>
            Fetches your home page and one product page, the way a visitor&apos;s
            browser would.
          </s-list-item>
          <s-list-item>
            Reads your theme code and app embeds through the Shopify API — this
            part works even while your store is password-protected.
          </s-list-item>
          <s-list-item>
            App embeds load their own scripts; any of those scripts that match
            the blocker list are still held until consent.
          </s-list-item>
          <s-list-item>
            Nothing is installed or changed on your storefront by scanning.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

function FindingRow({
  finding,
  tone,
  badge,
}: {
  finding: TrackerFinding;
  tone: "success" | "info" | "warning";
  badge: string;
}) {
  const categoryLabel =
    finding.category === "unknown"
      ? "uncategorized"
      : finding.category;
  return (
    <s-stack direction="inline" gap="small-200">
      <s-badge tone={tone}>{badge}</s-badge>
      <s-text>{finding.service}</s-text>
      <s-text color="subdued">
        {categoryLabel} · seen in: {finding.sources.join(", ")}
      </s-text>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
