/**
 * Home: onboarding checklist and status overview.
 *
 * The "activate app embed" link currently opens the theme editor's App
 * embeds panel. Once the theme app extension exists (step 5), the URL gains
 * `&activateAppId={extension-uuid}/{handle}` so activation is pre-toggled —
 * see buildThemeEditorUrl below.
 */
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { syncPlanFromBilling } from "../models/billing.server";
import { getRegionRules } from "../models/regionRules.server";
import { isEmbedActive } from "../models/embedStatus.server";
import prisma from "../db.server";

/**
 * One-click deep link to the theme editor with the Consentinel app embed
 * pre-toggled: the merchant only has to click Save.
 * Per Shopify's deep-link format, activateAppId is `{api_key}/{block handle}`
 * — the app's client id, NOT the extension uuid (the uuid form 404s).
 */
function buildThemeEditorUrl(shop: string): string {
  const storeHandle = shop.replace(".myshopify.com", "");
  const apiKey = process.env.SHOPIFY_API_KEY ?? "";
  return (
    `https://admin.shopify.com/store/${storeHandle}/themes/current/editor` +
    `?context=apps&template=index&activateAppId=${apiKey}/consent-banner`
  );
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  // Merchants land here whenever they open the app, so this is where the
  // cached plan gets reconciled with the Billing API (expired trials,
  // subscriptions cancelled outside the app).
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [settings, rules, eventCount, recentByAction, embedActive] =
    await Promise.all([
      syncPlanFromBilling(billing, admin, session.shop),
      getRegionRules(session.shop),
      prisma.consentEvent.count({ where: { shop: session.shop } }),
      prisma.consentEvent.groupBy({
        by: ["action"],
        where: { shop: session.shop, createdAt: { gte: since } },
        _count: { _all: true },
      }),
      isEmbedActive(admin),
    ]);

  const countFor = (action: string) =>
    recentByAction.find((row) => row.action === action)?._count._all ?? 0;
  const accepts = countFor("accept_all");
  const rejects = countFor("reject_all");
  const custom = countFor("custom");
  const optOuts = countFor("sale_opt_out");
  const optInTotal = accepts + rejects + custom;

  return {
    themeEditorUrl: buildThemeEditorUrl(session.shop),
    embedActive,
    hasPolicyUrl: Boolean(settings.privacyPolicyUrl),
    activeRegionCount: rules.filter((rule) => rule.enabled).length,
    totalRegionCount: rules.length,
    eventCount,
    stats30: {
      total: optInTotal + optOuts,
      accepts,
      rejects,
      custom,
      optOuts,
      // Share of opt-in banner decisions that granted everything.
      acceptRate: optInTotal > 0 ? Math.round((accepts / optInTotal) * 100) : null,
    },
    plan: settings.plan,
  };
};

export default function Index() {
  const data = useLoaderData<typeof loader>();

  return (
    <s-page heading="Consentinel">
      <s-section heading="Setup checklist">
        <s-paragraph>
          Three steps to a compliant cookie banner on your storefront.
        </s-paragraph>
        <s-stack direction="block" gap="base">
          <ChecklistItem
            done={data.embedActive === true}
            title="1. Activate the app embed in your theme"
            description={
              data.embedActive === true
                ? "Done — the Consentinel embed is active in your live theme."
                : "The banner is delivered as a theme app embed. This link opens the theme editor with the Consentinel embed pre-toggled — just click Save."
            }
          >
            <s-button href={data.themeEditorUrl} target="_blank" variant="primary">
              Open theme editor
            </s-button>
          </ChecklistItem>

          <ChecklistItem
            done={data.hasPolicyUrl}
            title="2. Link your privacy policy"
            description={
              data.hasPolicyUrl
                ? "Done — your banner links to your privacy policy."
                : "Add your privacy policy URL so the banner can link to it. Most stores use /policies/privacy-policy."
            }
          >
            <s-button href="/app/settings">Banner settings</s-button>
          </ChecklistItem>

          <ChecklistItem
            done={data.activeRegionCount > 0}
            title="3. Review your region rules"
            description={`${data.activeRegionCount} of ${data.totalRegionCount} regions active. EU/UK show an opt-in banner; US privacy-law states use the Do Not Sell/Share model.`}
          >
            <s-button href="/app/regions">Region rules</s-button>
          </ChecklistItem>
        </s-stack>
      </s-section>

      <s-section heading="Consent activity — last 30 days">
        {data.stats30.total === 0 ? (
          <s-paragraph>
            {data.eventCount === 0
              ? "No consent decisions recorded yet. Activity appears once the banner is live."
              : "No decisions in the last 30 days."}
          </s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            <s-stack direction="inline" gap="base">
              <Stat label="Decisions" value={String(data.stats30.total)} />
              <Stat label="Accepted all" value={String(data.stats30.accepts)} />
              <Stat label="Rejected all" value={String(data.stats30.rejects)} />
              <Stat label="Customized" value={String(data.stats30.custom)} />
              <Stat label="Opt-outs (US)" value={String(data.stats30.optOuts)} />
              {data.stats30.acceptRate !== null && (
                <Stat label="Accept rate" value={`${data.stats30.acceptRate}%`} />
              )}
            </s-stack>
            <s-paragraph>
              <s-text color="subdued">
                {data.eventCount} decision{data.eventCount === 1 ? "" : "s"}{" "}
                recorded all-time. Records contain no personal information.
              </s-text>
            </s-paragraph>
          </s-stack>
        )}
        <s-button href="/app/log">View consent log</s-button>
      </s-section>

      <s-section slot="aside" heading="Plan">
        <s-paragraph>
          <s-badge tone={data.plan === "paid" ? "success" : "info"}>
            {data.plan === "paid" ? "Paid" : "Free"}
          </s-badge>
        </s-paragraph>
        <s-paragraph>
          <s-text color="subdued">
            The free plan is fully compliant out of the box. Pro adds region
            rule customization and removes the &quot;Powered by&quot; credit.
          </s-text>
        </s-paragraph>
        <s-button href="/app/plan">View plans</s-button>
      </s-section>

      <s-section slot="aside" heading="Compliance notes">
        <s-unordered-list>
          <s-list-item>
            Consent is recorded only on real visitor interaction — never
            automatically.
          </s-list-item>
          <s-list-item>
            Consent state is managed through Shopify&apos;s Customer Privacy API.
          </s-list-item>
          <s-list-item>
            The banner never runs inside checkout — Shopify renders checkout
            privacy natively.
          </s-list-item>
        </s-unordered-list>
      </s-section>
    </s-page>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-300">
        <s-heading>{value}</s-heading>
        <s-text color="subdued">{label}</s-text>
      </s-stack>
    </s-box>
  );
}

function ChecklistItem({
  done,
  title,
  description,
  children,
}: {
  done: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base">
      <s-stack direction="block" gap="small-200">
        <s-stack direction="inline" gap="small-200">
          <s-badge tone={done ? "success" : "warning"}>
            {done ? "Done" : "To do"}
          </s-badge>
          <s-heading>{title}</s-heading>
        </s-stack>
        <s-paragraph>
          <s-text color="subdued">{description}</s-text>
        </s-paragraph>
        <s-stack direction="inline" gap="base">{children}</s-stack>
      </s-stack>
    </s-box>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
