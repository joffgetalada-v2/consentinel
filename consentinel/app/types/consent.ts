/**
 * Shared consent-domain constants and types.
 *
 * This module is deliberately dependency-free (no Prisma, no React, no
 * server imports) so it can be consumed by all three surfaces:
 *   - the admin UI (Polaris forms + live preview)
 *   - the server model layer (validation)
 *   - the storefront theme-app-extension bundle (which must stay tiny)
 */

// ---------------------------------------------------------------------------
// Banner appearance
// ---------------------------------------------------------------------------

export const BANNER_POSITIONS = [
  "bottom_bar",
  "bottom_left",
  "bottom_right",
  "center_modal",
] as const;
export type BannerPosition = (typeof BANNER_POSITIONS)[number];

export const THEME_PRESETS = ["light", "dark"] as const;
export type ThemePreset = (typeof THEME_PRESETS)[number];

/** Bottom-bar width: contained = centered with a 960px cap, full = edge-to-edge. */
export const BANNER_WIDTHS = ["contained", "full"] as const;
export type BannerWidth = (typeof BANNER_WIDTHS)[number];

/** system = the OS-native UI stack; theme = inherit the storefront theme's font. */
export const BANNER_FONTS = ["system", "theme"] as const;
export type BannerFont = (typeof BANNER_FONTS)[number];

/**
 * Clamp ranges for the numeric styling settings (Pro). Shared by the admin
 * validation, the config builder, and the storefront bundle so a crafted
 * metafield can never inject out-of-range values into banner CSS.
 */
export const STYLE_LIMITS = {
  fontSize: { min: 12, max: 18, fallback: 14 },
  buttonFontSize: { min: 12, max: 18, fallback: 14 },
  borderWidth: { min: 0, max: 3, fallback: 1 },
} as const;

export function clampStyle(
  key: keyof typeof STYLE_LIMITS,
  value: unknown,
): number {
  const { min, max, fallback } = STYLE_LIMITS[key];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Consent semantics
// ---------------------------------------------------------------------------

/**
 * opt_in  — GDPR-style: nothing non-essential runs until the visitor consents.
 * opt_out — US "Do Not Sell/Share" style: tracking may run by default, and the
 *           visitor can actively opt out. Per Shopify's Customer Privacy API,
 *           the opt-out signal must only ever be sent on a real visitor
 *           interaction, never automatically on page load.
 */
export const CONSENT_MODES = ["opt_in", "opt_out"] as const;
export type ConsentMode = (typeof CONSENT_MODES)[number];

export const CONSENT_ACTIONS = [
  "accept_all",
  "reject_all",
  "custom",
  "sale_opt_out",
] as const;
export type ConsentAction = (typeof CONSENT_ACTIONS)[number];

/**
 * The three toggleable categories shown in the preferences modal.
 * "Necessary" is intentionally absent: it is always on, never stored,
 * and rendered as a disabled toggle in the UI.
 * These map 1:1 onto Shopify's setTrackingConsent categories.
 */
export interface ConsentCategories {
  preferences: boolean;
  analytics: boolean;
  marketing: boolean;
}

// ---------------------------------------------------------------------------
// Region groups
// ---------------------------------------------------------------------------

export interface RegionGroupDefinition {
  /** Stable code stored in RegionRule.region */
  code: string;
  /** Merchant-facing label for the admin UI */
  label: string;
  /** Which consent model this region uses by default */
  defaultMode: ConsentMode;
  /** Whether the rule ships enabled for new installs */
  defaultEnabled: boolean;
}

/**
 * Region groups a merchant can configure. EU/UK default to opt-in (GDPR /
 * UK GDPR); listed US states have comprehensive privacy laws with an
 * opt-out-of-sale model. Extend this list as new state laws take effect —
 * the storefront resolves a visitor's region against RegionRule rows, so a
 * new group needs no schema change.
 */
export const REGION_GROUPS: RegionGroupDefinition[] = [
  { code: "EU", label: "European Union (GDPR)", defaultMode: "opt_in", defaultEnabled: true },
  { code: "UK", label: "United Kingdom (UK GDPR)", defaultMode: "opt_in", defaultEnabled: true },
  { code: "US-CA", label: "California (CCPA/CPRA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-VA", label: "Virginia (VCDPA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-CO", label: "Colorado (CPA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-CT", label: "Connecticut (CTDPA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-UT", label: "Utah (UCPA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-TX", label: "Texas (TDPSA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-OR", label: "Oregon (OCPA)", defaultMode: "opt_out", defaultEnabled: true },
  { code: "US-MT", label: "Montana (MCDPA)", defaultMode: "opt_out", defaultEnabled: true },
];

export const REGION_CODES = REGION_GROUPS.map((g) => g.code);

// ---------------------------------------------------------------------------
// Visitor country → region group resolution
// ---------------------------------------------------------------------------

/**
 * EU members plus the EEA states (IS/LI/NO) — GDPR applies to all of them.
 * Used by the storefront bundle to resolve the visitor's country (from
 * Shopify's `localization.country`, which follows buyer IP) to a region
 * group WITHOUT depending on Shopify's cookie-banner region settings —
 * merchants disable Shopify's native banner entirely when using this app,
 * which also turns off the `shouldShowBanner()` signal.
 */
export const EU_COUNTRY_CODES = [
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR",
  "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL",
  "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "IS", "LI", "NO",
] as const;

/**
 * Maps an ISO country code to the region-group *family* used by RegionRule.
 * US state laws can't be resolved client-side (no state geolocation in
 * Liquid), so all US visitors map to the "US" family and the storefront
 * treats any enabled US-* rule as applying — the standard, conservative
 * approach for CCPA-style opt-out apps.
 */
export function regionFamilyForCountry(
  countryCode: string,
): "EU" | "UK" | "US" | null {
  const code = countryCode.toUpperCase();
  if ((EU_COUNTRY_CODES as readonly string[]).includes(code)) return "EU";
  if (code === "GB") return "UK";
  if (code === "US") return "US";
  return null;
}

// ---------------------------------------------------------------------------
// Validation helpers (tiny on purpose — no schema library in the MVP)
// ---------------------------------------------------------------------------

export function isBannerPosition(value: string): value is BannerPosition {
  return (BANNER_POSITIONS as readonly string[]).includes(value);
}

export function isThemePreset(value: string): value is ThemePreset {
  return (THEME_PRESETS as readonly string[]).includes(value);
}

export function isBannerWidth(value: string): value is BannerWidth {
  return (BANNER_WIDTHS as readonly string[]).includes(value);
}

export function isBannerFont(value: string): value is BannerFont {
  return (BANNER_FONTS as readonly string[]).includes(value);
}

export function isConsentMode(value: string): value is ConsentMode {
  return (CONSENT_MODES as readonly string[]).includes(value);
}

export function isConsentAction(value: string): value is ConsentAction {
  return (CONSENT_ACTIONS as readonly string[]).includes(value);
}

export function isHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);
}

/** Accepts absolute http(s) URLs or store-relative paths like /policies/privacy-policy */
export function isPolicyUrl(value: string): boolean {
  if (value.startsWith("/")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
