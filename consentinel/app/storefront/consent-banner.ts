/**
 * Consentinel storefront bundle.
 *
 * Runs from the `compliance_head` app embed, before any other script on the
 * page. Responsibilities, in execution order:
 *
 *   1. Push Google Consent Mode v2 DEFAULTS (denied) before gtag/GTM loads.
 *   2. Install the script blocker (MutationObserver + createElement patch)
 *      so non-essential third-party scripts can't run pre-consent.
 *   3. Load Shopify's Customer Privacy API and decide, from
 *      shouldShowBanner()/saleOfDataRegion() + the merchant's region rules,
 *      whether to show the opt-in banner, the opt-out (Do Not Sell) banner,
 *      or nothing.
 *   4. On a real visitor interaction — never automatically — call
 *      setTrackingConsent(), update Consent Mode, release blocked scripts
 *      for granted categories, and log the event via the app proxy.
 *
 * Deliberately dependency-free vanilla TypeScript; target bundle ≤ 18KB
 * minified (~6.6KB gzipped — the number that matters on the wire).
 * Consent state lives exclusively in Shopify's Customer Privacy API — we
 * never read or write Shopify cookies directly.
 *
 * Phase 2 plug-in points are marked with `PHASE2:` comments (TCF v2.3
 * signal emission, per-service script map, headless/Hydrogen support).
 */

import { regionFamilyForCountry } from "../types/consent";

// ---------------------------------------------------------------------------
// Types for the pieces of Shopify's storefront globals we touch
// ---------------------------------------------------------------------------

interface VisitorConsent {
  marketing: "yes" | "no" | "";
  analytics: "yes" | "no" | "";
  preferences: "yes" | "no" | "";
  sale_of_data: "yes" | "no" | "";
}

interface TrackingConsentInput {
  marketing?: boolean;
  analytics?: boolean;
  preferences?: boolean;
  sale_of_data?: boolean;
}

interface CustomerPrivacy {
  shouldShowBanner: () => boolean;
  saleOfDataRegion: () => boolean;
  currentVisitorConsent: () => VisitorConsent;
  setTrackingConsent: (
    consent: TrackingConsentInput,
    callback: (error?: unknown) => void,
  ) => void;
}

interface ConsentinelConfig {
  heading: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  customizeLabel: string;
  privacyPolicyUrl: string | null;
  /** Merchant logo (Pro feature); the server sends null on the free plan. */
  logoUrl: string | null;
  /** Logo width cap in px; height scales with the image's aspect ratio. */
  logoSize: number;
  logoPosition: "top" | "left" | "right";
  /** Centered-modal width in px (still capped at viewport - 32). */
  modalWidth: number;
  /** Bottom-left/right card width in px. */
  cardWidth: number;
  position: "bottom_bar" | "bottom_left" | "bottom_right" | "center_modal";
  themePreset: "light" | "dark";
  accentColor: string;
  /** Advanced styling (Pro); the server sends the defaults on free. */
  bannerWidth: "contained" | "full";
  fontFamily: "system" | "theme";
  fontSize: number;
  buttonFontSize: number;
  borderWidth: number;
  showBranding: boolean;
  /** Any enabled opt-in region rule (EU/UK…) */
  optIn: boolean;
  /** Any enabled opt-out region rule (US privacy-law states) */
  optOut: boolean;
  /** Enabled region rules for client-side region resolution. */
  regions: { region: string; mode: string }[];
}

declare global {
  interface Window {
    Shopify?: {
      loadFeatures?: (
        features: { name: string; version: string }[],
        callback: (error?: unknown) => void,
      ) => void;
      customerPrivacy?: CustomerPrivacy;
    };
    dataLayer?: unknown[];
    __consentinel?: {
      config: Partial<ConsentinelConfig> | null;
      /** Visitor country (ISO) from Liquid `localization.country`. */
      country?: string | null;
      proxyUrl: string;
    };
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/** Safe defaults for a fresh install whose metafield hasn't been written yet. */
const DEFAULTS: ConsentinelConfig = {
  heading: "We value your privacy",
  body:
    "We use cookies to enhance your browsing experience, serve personalized " +
    "content, and analyze our traffic. You can accept all cookies, reject " +
    "non-essential ones, or customize your preferences.",
  acceptLabel: "Accept all",
  rejectLabel: "Reject all",
  customizeLabel: "Customize",
  privacyPolicyUrl: null,
  logoUrl: null,
  logoSize: 120,
  logoPosition: "top",
  modalWidth: 460,
  cardWidth: 400,
  position: "bottom_bar",
  themePreset: "light",
  accentColor: "#1A1A1A",
  bannerWidth: "contained",
  fontFamily: "system",
  fontSize: 14,
  buttonFontSize: 14,
  borderWidth: 1,
  showBranding: true,
  optIn: true,
  optOut: true,
  regions: [],
};

const bootData = window.__consentinel;
const config: ConsentinelConfig = { ...DEFAULTS, ...(bootData?.config ?? {}) };
const proxyUrl = bootData?.proxyUrl ?? "/apps/consentinel/consent";

/**
 * Merchant preview: ?consentinel_preview=1 force-renders the banner
 * regardless of region or a stored decision, and turns button clicks into
 * plain dismissals (no consent written, no event logged) — so merchants
 * outside regulated regions can review styling and copy safely.
 * `=1` or `=opt_in` shows the customizable opt-in banner;
 * `=opt_out` shows the US "Do Not Sell" variant.
 */
const previewParam = /[?&]consentinel_preview=([^&]+)/.exec(window.location.search);
const PREVIEW_MODE: "opt_in" | "opt_out" | null = previewParam
  ? previewParam[1] === "opt_out"
    ? "opt_out"
    : "opt_in"
  : null;
const IS_PREVIEW = PREVIEW_MODE !== null;

type Category = "preferences" | "analytics" | "marketing";
const CATEGORIES: Category[] = ["preferences", "analytics", "marketing"];

// ---------------------------------------------------------------------------
// 1. Google Consent Mode v2 — defaults must precede any gtag/GTM execution
// ---------------------------------------------------------------------------

window.dataLayer = window.dataLayer || [];
// The rest parameter exists only to satisfy gtag's call signature; GCM
// requires pushing the live `arguments` object, not a copied array.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer!.push(arguments);
}

// Denied-by-default everywhere: correct for opt-in regions, and for opt-out
// regions we grant immediately after region resolution (below), before any
// visitor-visible delay matters. security_storage is always granted.
gtag("consent", "default", {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
});
// PHASE2: emit IAB TCF v2.3 signals alongside Consent Mode here.

function gcmUpdate(consent: { analytics: boolean; marketing: boolean; preferences: boolean }) {
  gtag("consent", "update", {
    ad_storage: consent.marketing ? "granted" : "denied",
    ad_user_data: consent.marketing ? "granted" : "denied",
    ad_personalization: consent.marketing ? "granted" : "denied",
    analytics_storage: consent.analytics ? "granted" : "denied",
    functionality_storage: consent.preferences ? "granted" : "denied",
    personalization_storage: consent.preferences ? "granted" : "denied",
  });
}

// ---------------------------------------------------------------------------
// 2. Script blocker
// ---------------------------------------------------------------------------

/**
 * Hostname fragments of common trackers, mapped to their consent category.
 * Google's own tags (gtag.js / GTM / GA4) are deliberately NOT blocked:
 * they are governed by Consent Mode v2 defaults above, which is Google's
 * supported mechanism and keeps conversion modeling working.
 * PHASE2: replace with a per-service map fed by the AI cookie scanner.
 */
const TRACKER_PATTERNS: Record<Category, RegExp> = {
  marketing:
    /connect\.facebook\.net|analytics\.tiktok\.com|static\.ads-twitter\.com|snap\.licdn\.com|sc-static\.net|pinimg\.com\/ct|ct\.pinterest\.com|doubleclick\.net|googleadservices\.com|googlesyndication\.com|ads\.microsoft\.com|bat\.bing\.com|criteo\.(com|net)|outbrain\.com|taboola\.com/i,
  analytics:
    /static\.hotjar\.com|script\.hotjar\.com|clarity\.ms|cdn\.mxpnl\.com|cdn\.segment\.com|cdn\.heapanalytics\.com|fullstory\.com|cdn\.amplitude\.com|matomo|plausible\.io|cdn\.mouseflow\.com|luckyorange\.com/i,
  preferences: /cdn\.weglot\.com|translate\.google\.com\/translate_a/i,
};

/** Explicit opt-in markers merchants can put on their own script tags:
 *  <script type="text/consentinel" data-category="analytics" src="…"> */
const MANAGED_TYPE = "text/consentinel";
const BLOCKED_TYPE = "text/consentinel-blocked";

const granted: Record<Category, boolean> = {
  preferences: false,
  analytics: false,
  marketing: false,
};
let blockingActive = true;

interface HeldScript {
  category: Category;
  src: string | null;
  content: string;
  attributes: Record<string, string>;
}
const heldScripts: HeldScript[] = [];

function categoryForScript(element: HTMLScriptElement): Category | null {
  const declared = element.getAttribute("data-category");
  if (element.type === MANAGED_TYPE && declared && CATEGORIES.includes(declared as Category)) {
    return declared as Category;
  }
  const src = element.src || "";
  if (!src) return null;
  for (const category of CATEGORIES) {
    if (TRACKER_PATTERNS[category].test(src)) return category;
  }
  return null;
}

function holdScript(element: HTMLScriptElement, category: Category): void {
  const attributes: Record<string, string> = {};
  for (const attr of Array.from(element.attributes)) {
    if (attr.name !== "type" && attr.name !== "src") attributes[attr.name] = attr.value;
  }
  heldScripts.push({
    category,
    src: element.getAttribute("src"),
    content: element.textContent ?? "",
    attributes,
  });
  // Neutralize: a non-executable type plus src removal stops the fetch/run.
  element.type = BLOCKED_TYPE;
  element.removeAttribute("src");
  element.textContent = "";
}

function releaseScripts(category: Category): void {
  for (let index = heldScripts.length - 1; index >= 0; index--) {
    const held = heldScripts[index];
    if (held.category !== category) continue;
    heldScripts.splice(index, 1);
    const script = document.createElement("script");
    for (const [name, value] of Object.entries(held.attributes)) {
      script.setAttribute(name, value);
    }
    if (held.src) script.src = held.src;
    else script.textContent = held.content;
    document.head.appendChild(script);
  }
}

// Catch parser-inserted and library-inserted scripts as they enter the DOM.
const observer = new MutationObserver((mutations) => {
  if (!blockingActive) return;
  for (const mutation of mutations) {
    for (const node of Array.from(mutation.addedNodes)) {
      if (node instanceof HTMLScriptElement && node.type !== BLOCKED_TYPE) {
        const category = categoryForScript(node);
        if (category && !granted[category]) holdScript(node, category);
      }
    }
  }
});
observer.observe(document.documentElement, { childList: true, subtree: true });

// Belt-and-braces for dynamically created scripts (e.g. injected by GTM):
// intercept the src assignment at creation time.
const originalCreateElement = document.createElement.bind(document);
document.createElement = function (tagName: string, options?: ElementCreationOptions) {
  const element = originalCreateElement(tagName, options);
  if (tagName.toLowerCase() === "script") {
    const script = element as HTMLScriptElement;
    const descriptor = Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, "src");
    if (descriptor?.set && descriptor.get) {
      Object.defineProperty(script, "src", {
        get() {
          return descriptor.get!.call(script) as string;
        },
        set(value: string) {
          if (blockingActive) {
            for (const category of CATEGORIES) {
              if (!granted[category] && TRACKER_PATTERNS[category].test(value)) {
                heldScripts.push({ category, src: value, content: "", attributes: {} });
                return; // swallow the assignment; released on consent
              }
            }
          }
          descriptor.set!.call(script, value);
        },
        configurable: true,
      });
    }
  }
  return element;
} as typeof document.createElement;

function applyGrants(consent: { preferences: boolean; analytics: boolean; marketing: boolean }): void {
  for (const category of CATEGORIES) {
    if (consent[category] && !granted[category]) {
      granted[category] = true;
      releaseScripts(category);
    } else {
      granted[category] = consent[category];
    }
  }
  gcmUpdate(consent);
}

function disableBlocking(): void {
  blockingActive = false;
  applyGrants({ preferences: true, analytics: true, marketing: true });
}

// ---------------------------------------------------------------------------
// 3. Customer Privacy API bootstrap + banner decision
// ---------------------------------------------------------------------------

/**
 * Loads Shopify's Customer Privacy API, retrying while Shopify's own runtime
 * boots. This script runs FIRST in <head> (the point of the compliance
 * target), which means `Shopify.loadFeatures` usually does not exist yet at
 * execution time — a single check would silently fail. Poll briefly
 * (100ms cadence, ~10s cap) until the API is available.
 */
function loadCustomerPrivacy(callback: (api: CustomerPrivacy) => void): void {
  let attempts = 0;
  const MAX_ATTEMPTS = 100;

  const retry = (): void => {
    if (++attempts <= MAX_ATTEMPTS) setTimeout(attempt, 100);
    // If we give up (non-Online-Store context), the blocker stays active and
    // nothing non-essential runs — failing closed is the compliant default.
  };

  const attempt = (): void => {
    const existing = window.Shopify?.customerPrivacy;
    if (existing) return callback(existing);

    const shopifyGlobal = window.Shopify;
    if (shopifyGlobal?.loadFeatures) {
      shopifyGlobal.loadFeatures(
        [{ name: "consent-tracking-api", version: "0.1" }],
        (error) => {
          if (!error && window.Shopify?.customerPrivacy) {
            callback(window.Shopify.customerPrivacy);
          } else {
            retry(); // Transient load failure — keep trying briefly.
          }
        },
      );
      return;
    }
    retry(); // Shopify runtime not booted yet.
  };

  attempt();
}

function hasDecision(consent: VisitorConsent): boolean {
  return (
    consent.marketing !== "" || consent.analytics !== "" || consent.preferences !== ""
  );
}

/**
 * Detects the visitor's country. Primary source: Shopify's IP-geolocation
 * endpoint (the one the Geolocation app uses) — `localization.country` from
 * Liquid is only the MARKET country, which falls back to the store's primary
 * market for visitors outside all configured markets (e.g. an EU visitor to
 * a US-only store would look like "US" and get the wrong consent model).
 * Falls back to the Liquid country if the endpoint is slow (>1.5s) or
 * unavailable; the script blocker stays active while we wait, so the page
 * remains fail-closed during detection.
 */
function detectCountry(callback: (country: string) => void): void {
  const fallback = bootData?.country ?? "";
  let settled = false;
  const settle = (value: string): void => {
    if (settled) return;
    settled = true;
    callback(value);
  };
  const timer = setTimeout(() => settle(fallback), 1500);

  try {
    fetch("/browsing_context_suggestions?country%5Benabled%5D=true", {
      headers: { Accept: "application/json" },
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((json: { detected_values?: { country?: { handle?: string } } } | null) => {
        clearTimeout(timer);
        settle(json?.detected_values?.country?.handle || fallback);
      })
      .catch(() => {
        clearTimeout(timer);
        settle(fallback);
      });
  } catch {
    clearTimeout(timer);
    settle(fallback);
  }
}

/**
 * Resolves the visitor's region group from the detected country and the
 * merchant's enabled region rules. This is the primary display signal:
 * Shopify's shouldShowBanner()/saleOfDataRegion() go silent when the
 * merchant disables the native cookie banner (required to avoid a double
 * banner), so we cannot rely on them alone.
 *
 * US visitors can't be resolved to a state client-side, so any enabled
 * US-* rule applies to all US visitors; opt_out wins if modes are mixed
 * (the CCPA-style default).
 */
function resolveLocalRegion(
  countryCode: string,
): { group: string; mode: "opt_in" | "opt_out" } | null {
  const country = countryCode.toUpperCase();
  if (!country || config.regions.length === 0) return null;
  const family = regionFamilyForCountry(country);
  if (!family) return null;

  if (family === "US") {
    const usRules = config.regions.filter((rule) => rule.region.startsWith("US-"));
    if (usRules.length === 0) return null;
    const mode = usRules.some((rule) => rule.mode === "opt_out") ? "opt_out" : "opt_in";
    return { group: "US", mode };
  }

  const rule = config.regions.find((candidate) => candidate.region === family);
  if (!rule || (rule.mode !== "opt_in" && rule.mode !== "opt_out")) return null;
  return { group: family, mode: rule.mode };
}

/** Region group for the audit log; set once during start(). */
let visitorRegion: string | null = null;

function start(api: CustomerPrivacy, country: string): void {
  const prior = api.currentVisitorConsent();
  const local = resolveLocalRegion(country);
  visitorRegion = local?.group ?? null;

  if (PREVIEW_MODE) {
    whenBodyReady(() => renderBanner(api, PREVIEW_MODE));
    return;
  }

  // Shopify's signals OR our own resolution — either may be the only one
  // present (native banner disabled → Shopify signals stay false; missing
  // metafield/country → local resolution stays null and Shopify decides).
  const saleRegion = api.saleOfDataRegion() || local?.mode === "opt_out";
  const needsBanner = api.shouldShowBanner() || local?.mode === "opt_in";

  if (saleRegion && config.optOut) {
    // Opt-out model: tracking may run by default. Unblock everything unless
    // the visitor previously opted out. The opt-out control stays available;
    // it fires ONLY on visitor interaction, per Shopify's requirements.
    if (prior.sale_of_data === "no") {
      applyGrants({ preferences: true, analytics: false, marketing: false });
    } else {
      disableBlocking();
    }
    if (prior.sale_of_data === "") {
      whenBodyReady(() => renderBanner(api, "opt_out"));
    }
    return;
  }

  if (needsBanner && config.optIn) {
    if (hasDecision(prior)) {
      // Returning visitor: honor the stored decision without re-prompting.
      applyGrants({
        preferences: prior.preferences === "yes",
        analytics: prior.analytics === "yes",
        marketing: prior.marketing === "yes",
      });
    } else {
      whenBodyReady(() => renderBanner(api, "opt_in"));
    }
    return;
  }

  // No regulation applies here (or the merchant disabled this region):
  // nothing to block, nothing to show.
  disableBlocking();
}

function whenBodyReady(callback: () => void): void {
  if (document.body) return callback();
  document.addEventListener("DOMContentLoaded", callback, { once: true });
}

// ---------------------------------------------------------------------------
// 4. Consent submission + event logging
// ---------------------------------------------------------------------------

/** Guards against double-clicks writing duplicate audit-log entries. */
let submitting = false;

function submitConsent(
  api: CustomerPrivacy,
  mode: "opt_in" | "opt_out",
  action: "accept_all" | "reject_all" | "custom" | "sale_opt_out",
  categories: { preferences: boolean; analytics: boolean; marketing: boolean },
  saleOfData: boolean | null,
): void {
  if (IS_PREVIEW) {
    // Preview is look-but-don't-touch: no consent write, no audit entry.
    removeBanner();
    return;
  }
  if (submitting) return;
  submitting = true;

  const input: TrackingConsentInput = { ...categories };
  if (saleOfData !== null) input.sale_of_data = saleOfData;

  api.setTrackingConsent(input, (error) => {
    if (error) {
      submitting = false; // Privacy API unavailable — keep blocked, allow retry.
      return;
    }
    applyGrants(categories);
    logEvent(mode, action, categories, saleOfData);
    removeBanner();
  });
}

function logEvent(
  mode: string,
  action: string,
  categories: { preferences: boolean; analytics: boolean; marketing: boolean },
  saleOfDataOptedOut: boolean | null,
): void {
  // Anonymous, PII-free audit entry; fire-and-forget.
  try {
    const token = getVisitorToken();
    void fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        action,
        categories,
        saleOfDataOptedOut: saleOfDataOptedOut === null ? null : !saleOfDataOptedOut,
        visitorToken: token,
        region: visitorRegion,
      }),
      keepalive: true,
    });
  } catch {
    // Logging must never break the storefront.
  }
}

function getVisitorToken(): string | null {
  // Our own localStorage key (not a Shopify cookie): a random token that
  // lets repeat decisions from one browser correlate in the merchant's log.
  try {
    const key = "consentinel:vt";
    let token = localStorage.getItem(key);
    if (!token) {
      token = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(key, token);
    }
    return token;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Banner UI (vanilla DOM, WCAG-conscious)
// ---------------------------------------------------------------------------

let bannerRoot: HTMLElement | null = null;
let lastFocused: Element | null = null;

function removeBanner(): void {
  bannerRoot?.remove();
  bannerRoot = null;
  if (lastFocused instanceof HTMLElement) lastFocused.focus();
}

function readableTextColor(hex: string): string {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return "#ffffff";
  let value = match[1];
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#1a1a1a" : "#ffffff";
}

/** Clamp a config number into [min,max]; malformed metafield values fall
 *  back so nothing out-of-range is ever interpolated into banner CSS. */
function num(value: unknown, min: number, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

function styles(): string {
  const dark = config.themePreset === "dark";
  const surface = dark ? "#212226" : "#ffffff";
  const text = dark ? "#f4f4f5" : "#1a1a1a";
  const subdued = dark ? "#a6a7ad" : "#57575c";
  const border = dark ? "#3a3b41" : "#e3e3e6";
  const hover = dark ? "#2c2d33" : "#f4f4f6";
  const accent = config.accentColor;
  const accentText = readableTextColor(accent);
  const font = "system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";

  // Advanced styling (Pro). Clamped again client-side (see num above).
  const fs = num(config.fontSize, 12, 18, 14);
  const bfs = num(config.buttonFontSize, 12, 18, 14);
  const bw = num(config.borderWidth, 0, 3, 1);
  const ls = num(config.logoSize, 20, 200, 120);
  const mw = num(config.modalWidth, 320, 720, 460);
  const cw = num(config.cardWidth, 280, 600, 400);
  // Phone sizes step down one notch from the merchant's choices (floor 13px).
  const fsm = Math.max(13, fs - 1);
  const bfsm = Math.max(13, bfs - 1);
  // Every element sets font via shorthand (so theme element selectors can't
  // leak in); when the merchant picks "match my theme's font", a trailing
  // font-family:inherit re-adopts the theme typeface while keeping our
  // explicit sizes and weights.
  const themed = config.fontFamily === "theme";
  const f = (weight: number, sizePx: number, lineHeight: number | string) =>
    `font:${weight} ${sizePx}px/${lineHeight} ${font}${themed ? ";font-family:inherit" : ""};`;

  const positionCss = {
    // Centered bar with a width cap — a viewport-wide bar leaves a dead
    // zone on large screens (text is capped at 62ch).
    bottom_bar:
      "left:50%;transform:translateX(-50%);bottom:16px;width:calc(100vw - 32px);max-width:960px;",
    bottom_left: `left:16px;bottom:16px;max-width:${cw}px;`,
    bottom_right: `right:16px;bottom:16px;max-width:${cw}px;`,
    center_modal:
      `left:50%;top:50%;transform:translate(-50%,-50%);width:min(${mw}px,calc(100vw - 32px));`,
  }[config.position] ?? "left:16px;right:16px;bottom:16px;";

  // Theme stylesheets target bare elements (h2, p, button, a), so every
  // element we render sets its typography and color EXPLICITLY — the
  // two-class specificity below beats any element or single-class theme rule.
  // NOTE the backdrop class is deliberately NOT named "overlay"/"backdrop":
  // adblock annoyance lists hide elements matching those generic patterns,
  // which is how the modal's dim layer vanished for Brave users.
  return `
.cstl-scrim{position:fixed;inset:0;background:rgba(15,15,18,.5);z-index:2147483646;
  backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)}
.cstl-banner{position:fixed;${positionCss}z-index:2147483647;background:${surface};color:${text};
  border:${bw}px solid ${border};border-radius:16px;
  box-shadow:0 16px 48px rgba(0,0,0,.22),0 2px 8px rgba(0,0,0,.10);
  padding:22px 24px;${f(400, fs, 1.55)}text-align:left;letter-spacing:normal}
.cstl-banner:focus{outline:none}
.cstl-banner--wfull{left:0;right:0;bottom:0;width:auto;max-width:none;transform:none;
  border-radius:0;border-width:${bw}px 0 0}
.cstl-banner,.cstl-banner *{box-sizing:border-box}
.cstl-banner .cstl-logo{display:block;max-width:${ls}px;max-height:200px;width:auto;height:auto;
  margin:0 0 12px;border:0;padding:0}
.cstl-content--ll,.cstl-content--lr{display:flex;align-items:center;gap:16px}
.cstl-content--lr{flex-direction:row-reverse;justify-content:flex-end}
.cstl-content--ll .cstl-logo,.cstl-content--lr .cstl-logo{margin:0;flex:none}
.cstl-banner .cstl-heading{${f(600, fs + 2, 1.3)}letter-spacing:-.01em;color:${text};
  margin:0 0 8px;padding:0;text-transform:none}
.cstl-banner .cstl-body{${f(400, fs, 1.55)}letter-spacing:normal;text-transform:none;color:${subdued};margin:0 0 16px;padding:0;max-width:62ch}
.cstl-banner .cstl-body a{font:inherit;letter-spacing:normal;text-transform:none;color:${text};text-decoration:underline;text-underline-offset:2px}
.cstl-banner .cstl-body a:hover{color:${accent}}
.cstl-main{display:flex;flex-direction:column}
.cstl-banner--bottom_bar .cstl-main{flex-direction:row;align-items:center;justify-content:space-between;gap:28px}
.cstl-banner--bottom_bar .cstl-body{margin:0}
.cstl-banner--bottom_bar .cstl-actions{flex:none}
.cstl-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.cstl-banner .cstl-btn{${f(600, bfs, 1)}letter-spacing:normal;border-radius:10px;
  padding:11px 20px;cursor:pointer;border:1px solid ${border};background:transparent;color:${text};
  margin:0;text-transform:none;min-height:0;transition:background-color .15s ease,filter .15s ease}
.cstl-banner .cstl-btn:hover{background:${hover}}
.cstl-banner .cstl-btn:focus-visible,.cstl-banner .cstl-link:focus-visible,
.cstl-banner .cstl-toggle:focus-visible{outline:2px solid currentColor;outline-offset:2px}
.cstl-banner .cstl-btn--primary{background:${accent};border-color:${accent};color:${accentText}}
.cstl-banner .cstl-btn--primary:hover{background:${accent};filter:brightness(1.12)}
.cstl-banner .cstl-link{${f(500, bfs, 1)}letter-spacing:normal;background:none;border:none;padding:11px 4px;margin:0;
  cursor:pointer;color:${subdued};text-decoration:underline;text-underline-offset:2px;text-transform:none}
.cstl-banner .cstl-link:hover{color:${text}}
.cstl-banner .cstl-brand{margin:14px 0 0;${f(400, 11, 1)}letter-spacing:normal;color:${subdued};opacity:.85}
.cstl-cats{display:flex;flex-direction:column;gap:8px;margin:0 0 16px;padding:0;list-style:none}
.cstl-banner .cstl-cat{border:1px solid ${border};border-radius:10px;padding:0;margin:0;list-style:none}
.cstl-banner .cstl-catrow{display:flex;justify-content:space-between;align-items:center;gap:12px;
  padding:11px 14px;margin:0;cursor:pointer;font:inherit;text-decoration:none;text-transform:none}
.cstl-banner .cstl-catrow--locked{cursor:default}
.cstl-banner .cstl-cat b{${f(600, fs - 0.5, 1.4)}letter-spacing:normal;text-transform:none;text-decoration:none;color:${text};display:block}
.cstl-banner .cstl-cat small{display:block;${f(400, fs - 1.5, 1.45)}letter-spacing:normal;text-transform:none;text-decoration:none;color:${subdued};margin-top:1px}
.cstl-banner .cstl-toggle{appearance:none;-webkit-appearance:none;width:20px;height:20px;margin:0;
  flex:none;border:2px solid ${subdued};border-radius:6px;background:transparent;cursor:pointer;
  position:relative;transform:none;transition:background-color .15s ease,border-color .15s ease}
.cstl-banner .cstl-toggle:checked{background:${text};border-color:${text}}
.cstl-banner .cstl-toggle:checked::after{content:"";position:absolute;left:4.5px;top:1px;width:5px;
  height:10px;border:solid ${surface};border-width:0 2px 2px 0;transform:rotate(45deg)}
.cstl-banner .cstl-toggle:disabled{opacity:.5;cursor:not-allowed}
@media (max-width:760px){.cstl-banner--bottom_bar .cstl-main{flex-direction:column;align-items:stretch;gap:0}
  .cstl-banner--bottom_bar .cstl-body{margin:0 0 16px}
  .cstl-content--ll,.cstl-content--lr{display:block}
  .cstl-content--ll .cstl-logo,.cstl-content--lr .cstl-logo{margin:0 0 12px}}
@media (max-width:520px){.cstl-banner{left:12px;right:12px;bottom:12px;width:auto;max-width:none;padding:18px;
  transform:none;top:auto;font-size:${fsm}px}.cstl-banner--wfull{left:0;right:0;bottom:0}
  .cstl-banner .cstl-heading{font-size:${fsm + 2}px}
  .cstl-banner .cstl-body{font-size:${fsm}px}
  .cstl-banner .cstl-btn,.cstl-banner .cstl-link{font-size:${bfsm}px}
  .cstl-banner .cstl-logo{max-width:min(${ls}px,55vw)}
  .cstl-actions .cstl-btn{flex:1 1 40%;text-align:center;padding:11px 12px}}
@media (prefers-reduced-motion:no-preference){.cstl-banner{animation:cstl-in .28s cubic-bezier(.16,1,.3,1)}}
@keyframes cstl-in{from{opacity:0}to{opacity:1}}
`;
}

function renderBanner(api: CustomerPrivacy, mode: "opt_in" | "opt_out"): void {
  if (bannerRoot) return;
  lastFocused = document.activeElement;

  bannerRoot = document.createElement("div");
  bannerRoot.id = "consentinel-root";
  const styleTag = document.createElement("style");
  styleTag.textContent = styles();
  bannerRoot.appendChild(styleTag);

  if (config.position === "center_modal") {
    const scrim = document.createElement("div");
    scrim.className = "cstl-scrim";
    bannerRoot.appendChild(scrim);
  }

  const panel = document.createElement("div");
  panel.className =
    `cstl-banner cstl-banner--${config.position}` +
    (config.position === "bottom_bar" && config.bannerWidth === "full"
      ? " cstl-banner--wfull"
      : "");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", config.position === "center_modal" ? "true" : "false");
  panel.setAttribute("aria-labelledby", "cstl-heading");
  panel.setAttribute("aria-describedby", "cstl-body");

  const policyLink = config.privacyPolicyUrl
    ? ` <a href="${escapeAttribute(config.privacyPolicyUrl)}">Privacy policy</a>`
    : "";

  const heading =
    mode === "opt_out" ? "Your privacy choices" : escapeHtml(config.heading);
  const body =
    mode === "opt_out"
      ? "We may share information about your use of our site for advertising. You can opt out of the sale or sharing of your personal information."
      : escapeHtml(config.body);
  // Merchant logo (Pro): decorative next to the heading, so alt stays empty.
  const logo = config.logoUrl
    ? `<img class="cstl-logo" src="${escapeAttribute(config.logoUrl)}" alt="">`
    : "";

  // Content and actions live in one flex container so the bottom bar can
  // lay them out side by side (text left, buttons right) on wide screens.
  // A left/right logo flexes beside the text block; "top" keeps it stacked.
  const textHtml =
    `<h2 class="cstl-heading" id="cstl-heading">${heading}</h2>` +
    `<p class="cstl-body" id="cstl-body">${body}${policyLink}</p>`;
  const sideLogo =
    logo && (config.logoPosition === "left" || config.logoPosition === "right");
  const contentClass = sideLogo
    ? ` cstl-content--${config.logoPosition === "left" ? "ll" : "lr"}`
    : "";
  panel.innerHTML =
    `<div class="cstl-main">` +
    `<div class="cstl-content${contentClass}">` +
    (sideLogo ? `${logo}<div>${textHtml}</div>` : logo + textHtml) +
    `</div>` +
    `<div class="cstl-actions"></div>` +
    `</div>` +
    (config.showBranding ? `<div class="cstl-brand">Powered by Consentinel</div>` : "");

  const actions = panel.querySelector(".cstl-actions")!;

  if (mode === "opt_out") {
    actions.appendChild(
      button("Do Not Sell or Share My Personal Information", "cstl-btn cstl-btn--primary", () =>
        submitConsent(api, "opt_out", "sale_opt_out", { preferences: true, analytics: false, marketing: false }, false),
      ),
    );
    actions.appendChild(button("Dismiss", "cstl-btn", () => removeBanner()));
  } else {
    actions.appendChild(
      button(config.acceptLabel, "cstl-btn cstl-btn--primary", () =>
        submitConsent(api, "opt_in", "accept_all", { preferences: true, analytics: true, marketing: true }, null),
      ),
    );
    actions.appendChild(
      button(config.rejectLabel, "cstl-btn", () =>
        submitConsent(api, "opt_in", "reject_all", { preferences: false, analytics: false, marketing: false }, null),
      ),
    );
    actions.appendChild(
      button(config.customizeLabel, "cstl-link", () => renderPreferences(api, panel)),
    );
  }

  bannerRoot.appendChild(panel);
  document.body.appendChild(bannerRoot);

  // Focus the dialog itself, not its first button: screen readers announce
  // the banner either way, but focusing a button on page load draws a
  // focus-visible ring that merchants read as a broken border. Keyboard
  // users get the ring back the moment they Tab.
  panel.tabIndex = -1;
  panel.focus();
  if (config.position === "center_modal") trapFocus(panel);
}

/** Swaps the banner content for the category preferences view. */
function renderPreferences(api: CustomerPrivacy, panel: HTMLElement): void {
  const state = { preferences: false, analytics: false, marketing: false };

  panel.innerHTML =
    `<h2 class="cstl-heading" id="cstl-heading">Privacy preferences</h2>` +
    `<ul class="cstl-cats">` +
    categoryRow("Necessary", "Required for the store to function. Always on.", null) +
    categoryRow("Preferences", "Remembers your settings, like language or region.", "preferences") +
    categoryRow("Analytics", "Helps us understand how the store is used.", "analytics") +
    categoryRow("Marketing", "Used to personalize and measure advertising.", "marketing") +
    `</ul>` +
    `<div class="cstl-actions"></div>`;

  for (const category of CATEGORIES) {
    const input = panel.querySelector<HTMLInputElement>(`input[data-cat="${category}"]`);
    input?.addEventListener("change", () => {
      state[category] = Boolean(input.checked);
    });
  }

  const actions = panel.querySelector(".cstl-actions")!;
  actions.appendChild(
    button("Save preferences", "cstl-btn cstl-btn--primary", () =>
      submitConsent(api, "opt_in", "custom", { ...state }, null),
    ),
  );
  actions.appendChild(
    button(config.acceptLabel, "cstl-btn", () =>
      submitConsent(api, "opt_in", "accept_all", { preferences: true, analytics: true, marketing: true }, null),
    ),
  );

  panel.querySelector<HTMLButtonElement>("button")?.focus();
  trapFocus(panel);
}

function categoryRow(name: string, description: string, category: Category | null): string {
  const control =
    category === null
      ? `<input class="cstl-toggle" type="checkbox" checked disabled aria-label="${name} (always on)">`
      : `<input class="cstl-toggle" type="checkbox" data-cat="${category}" aria-label="${name}">`;
  // The whole row is a <label>, so clicking the text toggles the checkbox.
  const locked = category === null ? " cstl-catrow--locked" : "";
  return (
    `<li class="cstl-cat"><label class="cstl-catrow${locked}">` +
    `<span><b>${name}</b><small>${description}</small></span>${control}` +
    `</label></li>`
  );
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement("button");
  element.type = "button";
  element.className = className;
  element.textContent = label;
  element.addEventListener("click", onClick);
  return element;
}

/** Keyboard focus trap for the modal variant (WCAG 2.4.3 / 2.1.2). */
function trapFocus(panel: HTMLElement): void {
  panel.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && config.position !== "center_modal") {
      removeBanner();
      return;
    }
    if (event.key !== "Tab") return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button, a[href], input:not([disabled])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    // The panel itself holds focus right after render (tabindex="-1"), so
    // shift-Tab from it must wrap to the end, not escape the dialog.
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

loadCustomerPrivacy((api) => detectCountry((country) => start(api, country)));

// Makes this file a module so the `declare global` augmentation above is valid.
export {};
