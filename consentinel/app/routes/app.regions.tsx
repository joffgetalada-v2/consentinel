/**
 * Region rules screen: per-region consent model (opt-in vs opt-out) and an
 * enable/disable switch. Changes save immediately — there's no draft state
 * worth batching for a 10-row table.
 */
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useEffect } from "react";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { canEditRegionRules } from "../models/billing.server";
import {
  getRegionRules,
  updateRegionRule,
} from "../models/regionRules.server";
import { getShopSettings } from "../models/shopSettings.server";
import { syncStorefrontConfig } from "../models/storefrontConfig.server";
import { CONSENT_MODES, REGION_GROUPS } from "../types/consent";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [rules, settings] = await Promise.all([
    getRegionRules(session.shop),
    getShopSettings(session.shop),
  ]);
  return { rules, canEdit: canEditRegionRules(settings.plan) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);

  // Free plan keeps the compliant defaults; customization is a Pro feature.
  // The UI disables the controls, but the plan cache can be stale — recheck.
  const settings = await getShopSettings(session.shop);
  if (!canEditRegionRules(settings.plan)) {
    return {
      ok: false as const,
      error: "Customizing region rules requires the Pro plan",
    };
  }

  const form = await request.formData();
  const region = String(form.get("region") ?? "");
  const mode = form.get("mode");
  const enabled = form.get("enabled");

  await updateRegionRule(session.shop, {
    region,
    ...(mode !== null ? { mode: String(mode) } : {}),
    ...(enabled !== null ? { enabled: enabled === "true" } : {}),
  });
  // Region rules decide opt-in vs opt-out on the storefront — re-sync.
  await syncStorefrontConfig(admin, session.shop);
  return { ok: true as const, error: null };
};

const MODE_LABELS: Record<string, string> = {
  opt_in: "Opt-in banner (GDPR-style)",
  opt_out: "Opt-out — Do Not Sell/Share",
};

export default function Regions() {
  const { rules, canEdit } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      if (fetcher.data.ok) {
        shopify.toast.show("Region rule updated");
      } else {
        shopify.toast.show(fetcher.data.error, { isError: true });
      }
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const labelFor = (code: string) =>
    REGION_GROUPS.find((group) => group.code === code)?.label ?? code;

  return (
    <s-page heading="Region rules">
      <s-section>
        {!canEdit && (
          <s-banner tone="info" heading="Region customization is a Pro feature">
            <s-paragraph>
              Your store runs the compliant defaults below — EU/UK opt-in, US
              privacy-law states opt-out.{" "}
              <s-link href="/app/plan">Upgrade to Pro</s-link> to change consent
              models per region or disable regions.
            </s-paragraph>
          </s-banner>
        )}
        <s-paragraph>
          Visitors are shown the consent model configured for their region.
          Regions you disable get no banner at all — only do that for regions
          where you&apos;re confident no privacy law applies to your store.
        </s-paragraph>
        <s-table variant="auto">
          <s-table-header-row>
            <s-table-header>Region</s-table-header>
            <s-table-header>Consent model</s-table-header>
            <s-table-header>Active</s-table-header>
          </s-table-header-row>
          <s-table-body>
            {rules.map((rule) => (
              <s-table-row key={rule.region}>
                <s-table-cell>
                  <s-text>{labelFor(rule.region)}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-select
                    label="Consent model"
                    labelAccessibilityVisibility="exclusive"
                    value={rule.mode}
                    {...(!canEdit ? { disabled: true } : {})}
                    onChange={(event) =>
                      fetcher.submit(
                        { region: rule.region, mode: event.currentTarget.value },
                        { method: "POST" },
                      )
                    }
                  >
                    {CONSENT_MODES.map((mode) => (
                      <s-option key={mode} value={mode}>
                        {MODE_LABELS[mode]}
                      </s-option>
                    ))}
                  </s-select>
                </s-table-cell>
                <s-table-cell>
                  <s-switch
                    label={`Enable ${labelFor(rule.region)}`}
                    labelAccessibilityVisibility="exclusive"
                    checked={rule.enabled}
                    {...(!canEdit ? { disabled: true } : {})}
                    onChange={(event) =>
                      fetcher.submit(
                        {
                          region: rule.region,
                          enabled: String(event.currentTarget.checked),
                        },
                        { method: "POST" },
                      )
                    }
                  />
                </s-table-cell>
              </s-table-row>
            ))}
          </s-table-body>
        </s-table>
      </s-section>

      <s-section slot="aside" heading="How rules are applied">
        <s-paragraph>
          <s-text color="subdued">
            The storefront resolves each visitor&apos;s region using Shopify&apos;s
            Customer Privacy API signals. Opt-in regions block non-essential
            scripts until consent; opt-out regions allow them but honor &quot;Do
            Not Sell/Share&quot; requests when the visitor opts out.
          </s-text>
        </s-paragraph>
        <s-paragraph>
          <s-text color="subdued">
            EU/UK default to opt-in; US states with comprehensive privacy laws
            default to opt-out. New state laws can be added without a schema
            change.
          </s-text>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
