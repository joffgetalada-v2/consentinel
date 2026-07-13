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
 * Deliberately dependency-free vanilla TypeScript; target bundle < 15KB.
 * Consent state lives exclusively in Shopify's Customer Privacy API — we
 * never read or write Shopify cookies directly.
 *
 * Phase 2 plug-in points are marked with `PHASE2:` comments (TCF v2.3
 * signal emission, per-service script map, headless/Hydrogen support).
 */

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
  position: "bottom_bar" | "bottom_left" | "bottom_right" | "center_modal";
  themePreset: "light" | "dark";
  accentColor: string;
  showBranding: boolean;
  /** Any enabled opt-in region rule (EU/UK…) */
  optIn: boolean;
  /** Any enabled opt-out region rule (US privacy-law states) */
  optOut: boolean;
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
    __consentinel?: { config: Partial<ConsentinelConfig> | null; proxyUrl: string };
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
  position: "bottom_bar",
  themePreset: "light",
  accentColor: "#1A1A1A",
  showBranding: true,
  optIn: true,
  optOut: true,
};

const bootData = window.__consentinel;
const config: ConsentinelConfig = { ...DEFAULTS, ...(bootData?.config ?? {}) };
const proxyUrl = bootData?.proxyUrl ?? "/apps/consentinel/consent";

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

function start(api: CustomerPrivacy): void {
  const prior = api.currentVisitorConsent();
  const saleRegion = api.saleOfDataRegion();
  const needsBanner = api.shouldShowBanner();

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

function submitConsent(
  api: CustomerPrivacy,
  mode: "opt_in" | "opt_out",
  action: "accept_all" | "reject_all" | "custom" | "sale_opt_out",
  categories: { preferences: boolean; analytics: boolean; marketing: boolean },
  saleOfData: boolean | null,
): void {
  const input: TrackingConsentInput = { ...categories };
  if (saleOfData !== null) input.sale_of_data = saleOfData;

  api.setTrackingConsent(input, (error) => {
    if (error) return; // Privacy API unavailable — keep everything blocked.
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

function styles(): string {
  const dark = config.themePreset === "dark";
  const surface = dark ? "#1f1f1f" : "#ffffff";
  const text = dark ? "#f5f5f5" : "#1a1a1a";
  const subdued = dark ? "#b3b3b3" : "#555555";
  const border = dark ? "#3d3d3d" : "#dddddd";
  const accent = config.accentColor;
  const accentText = readableTextColor(accent);

  const positionCss = {
    bottom_bar: "left:16px;right:16px;bottom:16px;",
    bottom_left: "left:16px;bottom:16px;max-width:380px;",
    bottom_right: "right:16px;bottom:16px;max-width:380px;",
    center_modal: "left:50%;top:50%;transform:translate(-50%,-50%);width:min(440px,calc(100vw - 32px));",
  }[config.position];

  return `
.cstl-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2147483646}
.cstl-banner{position:fixed;${positionCss}z-index:2147483647;background:${surface};color:${text};
  border:1px solid ${border};border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.25);
  padding:20px;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
.cstl-heading{font-size:16px;font-weight:700;margin:0 0 6px}
.cstl-body{color:${subdued};margin:0 0 14px}
.cstl-body a{color:${accent};text-decoration:underline}
.cstl-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.cstl-btn{font:inherit;font-weight:600;border-radius:8px;padding:10px 18px;cursor:pointer;border:1px solid ${border};background:transparent;color:${text}}
.cstl-btn:focus-visible{outline:3px solid ${accent};outline-offset:2px}
.cstl-btn--primary{background:${accent};border-color:${accent};color:${accentText}}
.cstl-link{font:inherit;background:none;border:none;padding:10px 4px;cursor:pointer;color:${subdued};text-decoration:underline}
.cstl-link:focus-visible{outline:3px solid ${accent};outline-offset:2px}
.cstl-brand{margin-top:10px;font-size:11px;color:${subdued}}
.cstl-cats{display:flex;flex-direction:column;gap:10px;margin:0 0 14px;padding:0;list-style:none}
.cstl-cat{display:flex;justify-content:space-between;align-items:center;gap:12px;border:1px solid ${border};border-radius:8px;padding:10px 12px}
.cstl-cat b{font-weight:600}
.cstl-cat small{display:block;color:${subdued}}
.cstl-toggle{width:20px;height:20px;accent-color:${accent}}
@media (prefers-reduced-motion:no-preference){.cstl-banner{animation:cstl-in .25s ease}}
@keyframes cstl-in{from{opacity:0;transform:translateY(8px)}to{opacity:1}}
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
    const overlay = document.createElement("div");
    overlay.className = "cstl-overlay";
    bannerRoot.appendChild(overlay);
  }

  const panel = document.createElement("div");
  panel.className = "cstl-banner";
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

  panel.innerHTML =
    `<h2 class="cstl-heading" id="cstl-heading">${heading}</h2>` +
    `<p class="cstl-body" id="cstl-body">${body}${policyLink}</p>` +
    `<div class="cstl-actions"></div>` +
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

  const firstButton = panel.querySelector<HTMLButtonElement>("button");
  firstButton?.focus();
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
  return `<li class="cstl-cat"><span><b>${name}</b><small>${description}</small></span>${control}</li>`;
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
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
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

loadCustomerPrivacy(start);

// Makes this file a module so the `declare global` augmentation above is valid.
export {};
