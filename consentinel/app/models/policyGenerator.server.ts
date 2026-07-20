/**
 * Cookie-policy page generator (Pro).
 *
 * Turns the latest cookie-scan results into a merchant-editable Online Store
 * page ("Cookie Policy"). The page id is remembered on ShopSettings so
 * regeneration updates the same page; if the merchant deleted the page, a
 * fresh one is created. Requires the write_online_store_pages scope.
 *
 * The generated HTML is a starting point, not legal advice — the page is a
 * normal Online Store page the merchant can edit afterwards.
 */
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import { getShopSettings } from "./shopSettings.server";
import { getLatestScan, type TrackerFinding } from "./scanner.server";

const CATEGORY_SECTIONS: { key: string; title: string; description: string }[] = [
  {
    key: "essential",
    title: "Strictly necessary",
    description:
      "Required for the store to function — the cart, checkout, security, and " +
      "your cookie choices themselves. These cannot be switched off.",
  },
  {
    key: "preferences",
    title: "Preferences",
    description:
      "Remember choices like language, region, or embedded content settings " +
      "to personalize your visit.",
  },
  {
    key: "analytics",
    title: "Analytics",
    description:
      "Help us understand how visitors use the store (pages visited, time on " +
      "site) so we can improve it. Data is aggregated.",
  },
  {
    key: "marketing",
    title: "Marketing",
    description:
      "Used by advertising partners to measure campaigns and show more " +
      "relevant ads, including across other websites.",
  },
];

const HANDLING_LABELS: Record<TrackerFinding["handling"], string> = {
  blocked: "Blocked until you consent",
  consent_mode: "Runs in consent-aware mode (Google Consent Mode v2)",
  visible: "Set by the service once loaded",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildPolicyHtml(findings: TrackerFinding[] | null): string {
  const updated = new Date().toISOString().slice(0, 10);

  const sections = CATEGORY_SECTIONS.map((section) => {
    const rows = (findings ?? []).filter(
      (finding) => finding.category === section.key,
    );
    const table =
      rows.length === 0
        ? ""
        : `<table>
<thead><tr><th>Service</th><th>Handling before consent</th></tr></thead>
<tbody>
${rows
  .map(
    (finding) =>
      `<tr><td>${escapeHtml(finding.service)}</td><td>${HANDLING_LABELS[finding.handling]}</td></tr>`,
  )
  .join("\n")}
</tbody>
</table>`;
    return `<h3>${section.title}</h3>\n<p>${section.description}</p>\n${table}`;
  }).join("\n");

  const scanNote = findings
    ? `<p>The services listed above were identified by an automated scan of ` +
      `this store. We review this list regularly as the store changes.</p>`
    : `<p>We use cookies in the categories described above. A detailed ` +
      `service list will be published after our next site review.</p>`;

  return `<p><em>Last updated: ${updated}</em></p>
<p>This store uses cookies and similar technologies. Cookies in categories
other than “strictly necessary” are only used with your consent, which you
can give, refuse, or withdraw at any time.</p>
<h2>How to manage your choices</h2>
<p>Use the <strong>Privacy choices</strong> button (bottom corner of any
page) to review or change your cookie preferences, or to opt out of the
sale/sharing of personal information where that right applies. We also honor
the <a href="https://globalprivacycontrol.org/">Global Privacy Control</a>
browser signal. To exercise data rights (access, deletion, correction),
visit our <a href="/apps/consentinel/privacy">privacy request page</a>.</p>
<h2>Cookie categories</h2>
${sections}
${scanNote}
<p><em>Consent preferences on this store are managed by Consentinel.</em></p>`;
}

export interface GeneratePolicyResult {
  ok: boolean;
  message: string;
  /** Storefront path of the page when ok (e.g. /pages/cookie-policy). */
  pagePath?: string;
}

interface PageMutationResponse {
  page?: { id?: string; handle?: string } | null;
  userErrors?: { field?: string[] | null; message: string }[];
}

export async function generatePolicyPage(
  admin: AdminApiContext,
  shop: string,
): Promise<GeneratePolicyResult> {
  const settings = await getShopSettings(shop);
  const scan = await getLatestScan(shop);
  const body = buildPolicyHtml(
    scan?.status === "completed" ? scan.findings : null,
  );

  // Try updating the page we created before; fall back to creating anew if
  // the merchant deleted it (or we never made one).
  if (settings.policyPageId) {
    const updated = await runPageMutation(admin, "pageUpdate", {
      id: settings.policyPageId,
      page: { title: "Cookie Policy", body },
    });
    if (updated.page?.id) {
      return {
        ok: true,
        message: "Cookie Policy page updated",
        pagePath: `/pages/${updated.page.handle}`,
      };
    }
    await prisma.shopSettings.update({
      where: { shop },
      data: { policyPageId: null },
    });
  }

  const created = await runPageMutation(admin, "pageCreate", {
    page: { title: "Cookie Policy", body, isPublished: true },
  });
  if (!created.page?.id) {
    const detail =
      created.userErrors?.map((error) => error.message).join("; ") ||
      "unknown error";
    return { ok: false, message: `Could not create the page: ${detail}` };
  }
  await prisma.shopSettings.update({
    where: { shop },
    data: { policyPageId: created.page.id },
  });
  return {
    ok: true,
    message: "Cookie Policy page created",
    pagePath: `/pages/${created.page.handle}`,
  };
}

async function runPageMutation(
  admin: AdminApiContext,
  mutation: "pageCreate" | "pageUpdate",
  variables: Record<string, unknown>,
): Promise<PageMutationResponse> {
  const query =
    mutation === "pageCreate"
      ? `#graphql
        mutation consentinelPageCreate($page: PageCreateInput!) {
          pageCreate(page: $page) {
            page { id handle }
            userErrors { field message }
          }
        }`
      : `#graphql
        mutation consentinelPageUpdate($id: ID!, $page: PageUpdateInput!) {
          pageUpdate(id: $id, page: $page) {
            page { id handle }
            userErrors { field message }
          }
        }`;
  try {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();
    return (json.data?.[mutation] ?? {}) as PageMutationResponse;
  } catch (error) {
    return {
      userErrors: [
        {
          message:
            error instanceof Error
              ? error.message
              : "Page API request failed (is the write_online_store_pages permission granted?)",
        },
      ],
    };
  }
}
