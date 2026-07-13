/**
 * Storefront config delivery.
 *
 * The theme app extension reads its configuration from an app-owned
 * metafield on the AppInstallation ({{ app.metafields.consentinel.banner_config }}
 * in Liquid). That keeps the storefront fast — zero API calls at page load —
 * at the cost of having to re-sync the metafield whenever the merchant saves
 * settings or region rules. Call syncStorefrontConfig from every admin action
 * that changes banner-relevant state.
 *
 * App-owned metafields on the app's own installation require no extra
 * access scopes.
 */
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import { getShopSettings } from "./shopSettings.server";
import { getRegionRules } from "./regionRules.server";

/** Shape consumed by extensions/consent-banner/src/consent-banner.ts */
interface StorefrontConfig {
  v: 1;
  heading: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  customizeLabel: string;
  privacyPolicyUrl: string | null;
  position: string;
  themePreset: string;
  accentColor: string;
  showBranding: boolean;
  optIn: boolean;
  optOut: boolean;
}

export async function buildStorefrontConfig(shop: string): Promise<StorefrontConfig> {
  const [settings, rules] = await Promise.all([
    getShopSettings(shop),
    getRegionRules(shop),
  ]);
  return {
    v: 1,
    heading: settings.heading,
    body: settings.body,
    acceptLabel: settings.acceptLabel,
    rejectLabel: settings.rejectLabel,
    customizeLabel: settings.customizeLabel,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    position: settings.position,
    themePreset: settings.themePreset,
    accentColor: settings.accentColor,
    // Belt-and-braces: branding removal is a paid feature, so the free plan
    // always renders the credit even if the cached flag is stale.
    showBranding: settings.plan === "paid" ? settings.showBranding : true,
    optIn: rules.some((rule) => rule.enabled && rule.mode === "opt_in"),
    optOut: rules.some((rule) => rule.enabled && rule.mode === "opt_out"),
  };
}

export async function syncStorefrontConfig(
  admin: AdminApiContext,
  shop: string,
): Promise<void> {
  const config = await buildStorefrontConfig(shop);

  const installationResponse = await admin.graphql(
    `#graphql
    query consentinelAppInstallation {
      currentAppInstallation { id }
    }`,
  );
  const installationJson = await installationResponse.json();
  const ownerId = installationJson.data?.currentAppInstallation?.id;
  if (!ownerId) {
    throw new Error("Could not resolve app installation for metafield sync");
  }

  const setResponse = await admin.graphql(
    `#graphql
    mutation consentinelSyncConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        userErrors { field message }
      }
    }`,
    {
      variables: {
        metafields: [
          {
            ownerId,
            namespace: "consentinel",
            key: "banner_config",
            type: "json",
            value: JSON.stringify(config),
          },
        ],
      },
    },
  );
  const setJson = await setResponse.json();
  const userErrors = setJson.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(
      `Storefront config sync failed: ${userErrors
        .map((error: { message: string }) => error.message)
        .join(", ")}`,
    );
  }
}
