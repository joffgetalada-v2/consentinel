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
import { buildI18n, type LocaleStrings } from "./translations.server";
import { canUseAdvancedStyling } from "./billing.server";
import { STYLE_LIMITS } from "../types/consent";

/** Shape consumed by app/storefront/consent-banner.ts */
interface StorefrontConfig {
  v: 2;
  heading: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  customizeLabel: string;
  privacyPolicyUrl: string | null;
  /** Pro feature; null on the free plan. */
  logoUrl: string | null;
  logoSize: number;
  logoPosition: string;
  position: string;
  themePreset: string;
  accentColor: string;
  /** Floating "Privacy choices" reopen button (free; compliance feature). */
  showReopen: boolean;
  /** Advanced styling (Pro); the free plan always serves the defaults. */
  bannerWidth: string;
  fontFamily: string;
  fontSize: number;
  buttonFontSize: number;
  borderWidth: number;
  modalWidth: number;
  cardWidth: number;
  showBranding: boolean;
  optIn: boolean;
  optOut: boolean;
  /**
   * Enabled region rules, so the storefront can resolve the visitor's
   * region itself (Shopify's shouldShowBanner() goes silent when the
   * merchant disables the native cookie banner — which they must, to avoid
   * a double banner).
   */
  regions: { region: string; mode: string }[];
  /** Per-locale banner strings (Pro); absent on the free plan. */
  i18n?: Record<string, LocaleStrings>;
}

export async function buildStorefrontConfig(shop: string): Promise<StorefrontConfig> {
  const [settings, rules] = await Promise.all([
    getShopSettings(shop),
    getRegionRules(shop),
  ]);
  const styled = canUseAdvancedStyling(settings.plan);
  // Translations are Pro: only fetch/ship the map when it can apply.
  const i18n = settings.plan === "paid" ? await buildI18n(shop) : {};
  return {
    ...(Object.keys(i18n).length > 0 ? { i18n } : {}),
    v: 2,
    heading: settings.heading,
    body: settings.body,
    acceptLabel: settings.acceptLabel,
    rejectLabel: settings.rejectLabel,
    customizeLabel: settings.customizeLabel,
    privacyPolicyUrl: settings.privacyPolicyUrl,
    logoUrl: settings.plan === "paid" ? settings.logoUrl : null,
    logoSize: settings.logoSize,
    logoPosition: settings.logoPosition,
    position: settings.position,
    themePreset: settings.themePreset,
    accentColor: settings.accentColor,
    showReopen: settings.showReopen,
    bannerWidth: styled ? settings.bannerWidth : "contained",
    fontFamily: styled ? settings.fontFamily : "system",
    fontSize: styled ? settings.fontSize : STYLE_LIMITS.fontSize.fallback,
    buttonFontSize: styled
      ? settings.buttonFontSize
      : STYLE_LIMITS.buttonFontSize.fallback,
    borderWidth: styled ? settings.borderWidth : STYLE_LIMITS.borderWidth.fallback,
    modalWidth: styled ? settings.modalWidth : STYLE_LIMITS.modalWidth.fallback,
    cardWidth: styled ? settings.cardWidth : STYLE_LIMITS.cardWidth.fallback,
    // Belt-and-braces: branding removal is a paid feature, so the free plan
    // always renders the credit even if the cached flag is stale.
    showBranding: settings.plan === "paid" ? settings.showBranding : true,
    optIn: rules.some((rule) => rule.enabled && rule.mode === "opt_in"),
    optOut: rules.some((rule) => rule.enabled && rule.mode === "opt_out"),
    regions: rules
      .filter((rule) => rule.enabled)
      .map((rule) => ({ region: rule.region, mode: rule.mode })),
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
