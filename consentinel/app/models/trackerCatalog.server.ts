/**
 * Catalog of known third-party tracking services for the cookie scanner.
 *
 * Each entry's pattern is run against raw page HTML and theme source, so it
 * can match script hostnames AND distinctive inline snippet tokens (fbq(,
 * pintrk( …). Patterns must stay conservative — a false "we found a tracker"
 * costs merchant trust.
 *
 * `handling` describes what Consentinel does with the service BEFORE consent:
 * - "blocked":      the storefront script blocker holds it until consent.
 *                   KEEP IN SYNC with TRACKER_PATTERNS in
 *                   app/storefront/consent-banner.ts.
 * - "consent_mode": Google tags run but honor Consent Mode v2 defaults
 *                   (Google's supported mechanism; keeps conversion modeling).
 * - "visible":      detected but not blocked by the current blocker list —
 *                   shown to the merchant so nothing is silently missed.
 */

export type TrackerCategory =
  | "marketing"
  | "analytics"
  | "preferences"
  | "essential";

export type TrackerHandling = "blocked" | "consent_mode" | "visible";

export interface TrackerCatalogEntry {
  service: string;
  category: TrackerCategory;
  handling: TrackerHandling;
  pattern: RegExp;
}

export const TRACKER_CATALOG: TrackerCatalogEntry[] = [
  // --- Blocked pre-consent (mirror of the banner's TRACKER_PATTERNS) ------
  { service: "Meta (Facebook) Pixel", category: "marketing", handling: "blocked", pattern: /connect\.facebook\.net|fbq\s*\(/i },
  { service: "TikTok Pixel", category: "marketing", handling: "blocked", pattern: /analytics\.tiktok\.com|ttq\.load\s*\(/i },
  { service: "X (Twitter) Ads", category: "marketing", handling: "blocked", pattern: /static\.ads-twitter\.com|twq\s*\(\s*['"]init/i },
  { service: "LinkedIn Insight Tag", category: "marketing", handling: "blocked", pattern: /snap\.licdn\.com|_linkedin_partner_id/i },
  { service: "Snapchat Pixel", category: "marketing", handling: "blocked", pattern: /sc-static\.net|snaptr\s*\(/i },
  { service: "Pinterest Tag", category: "marketing", handling: "blocked", pattern: /pinimg\.com\/ct|ct\.pinterest\.com|pintrk\s*\(/i },
  { service: "Google Ads / DoubleClick", category: "marketing", handling: "blocked", pattern: /doubleclick\.net|googleadservices\.com|googlesyndication\.com/i },
  { service: "Microsoft Ads (Bing UET)", category: "marketing", handling: "blocked", pattern: /bat\.bing\.com|ads\.microsoft\.com/i },
  { service: "Criteo", category: "marketing", handling: "blocked", pattern: /criteo\.(com|net)/i },
  { service: "Outbrain", category: "marketing", handling: "blocked", pattern: /outbrain\.com/i },
  { service: "Taboola", category: "marketing", handling: "blocked", pattern: /taboola\.com/i },
  { service: "Hotjar", category: "analytics", handling: "blocked", pattern: /static\.hotjar\.com|script\.hotjar\.com/i },
  { service: "Microsoft Clarity", category: "analytics", handling: "blocked", pattern: /clarity\.ms/i },
  { service: "Mixpanel", category: "analytics", handling: "blocked", pattern: /cdn\.mxpnl\.com/i },
  { service: "Segment", category: "analytics", handling: "blocked", pattern: /cdn\.segment\.com/i },
  { service: "Heap", category: "analytics", handling: "blocked", pattern: /cdn\.heapanalytics\.com/i },
  { service: "FullStory", category: "analytics", handling: "blocked", pattern: /fullstory\.com/i },
  { service: "Amplitude", category: "analytics", handling: "blocked", pattern: /cdn\.amplitude\.com/i },
  { service: "Matomo", category: "analytics", handling: "blocked", pattern: /matomo/i },
  { service: "Plausible", category: "analytics", handling: "blocked", pattern: /plausible\.io/i },
  { service: "Mouseflow", category: "analytics", handling: "blocked", pattern: /cdn\.mouseflow\.com/i },
  { service: "Lucky Orange", category: "analytics", handling: "blocked", pattern: /luckyorange\.com/i },
  { service: "Weglot", category: "preferences", handling: "blocked", pattern: /cdn\.weglot\.com/i },
  { service: "Google Translate widget", category: "preferences", handling: "blocked", pattern: /translate\.google\.com\/translate_a/i },

  // --- Google tags: governed by Consent Mode v2, deliberately not blocked --
  { service: "Google Tag Manager / gtag", category: "analytics", handling: "consent_mode", pattern: /googletagmanager\.com/i },
  { service: "Google Analytics 4", category: "analytics", handling: "consent_mode", pattern: /google-analytics\.com/i },

  // --- Detected but not in the current blocker list ------------------------
  { service: "Klaviyo", category: "marketing", handling: "visible", pattern: /static\.klaviyo\.com|klaviyo\.com\/onsite|_learnq/i },
  { service: "Attentive", category: "marketing", handling: "visible", pattern: /cdn\.attn\.tv/i },
  { service: "Postscript", category: "marketing", handling: "visible", pattern: /sdk\.postscript\.io/i },
  { service: "Omnisend", category: "marketing", handling: "visible", pattern: /omnisnippet|omnisend\.com/i },
  { service: "Privy", category: "marketing", handling: "visible", pattern: /widget\.privy\.com/i },
  { service: "Mailchimp", category: "marketing", handling: "visible", pattern: /chimpstatic\.com|list-manage\.com/i },
  { service: "HubSpot", category: "marketing", handling: "visible", pattern: /js\.hs-scripts\.com|js\.hsforms\.net/i },
  { service: "Reddit Pixel", category: "marketing", handling: "visible", pattern: /redditstatic\.com\/ads|rdt\s*\(\s*['"]init/i },
  { service: "Quora Pixel", category: "marketing", handling: "visible", pattern: /a\.quora\.com/i },
  { service: "Amazon Ads", category: "marketing", handling: "visible", pattern: /amazon-adsystem\.com/i },
  { service: "AWIN", category: "marketing", handling: "visible", pattern: /dwin1\.com/i },
  { service: "Intercom", category: "preferences", handling: "visible", pattern: /widget\.intercom\.io/i },
  { service: "Zendesk", category: "preferences", handling: "visible", pattern: /static\.zdassets\.com/i },
  { service: "Tidio", category: "preferences", handling: "visible", pattern: /code\.tidio\.co/i },
  { service: "Gorgias", category: "preferences", handling: "visible", pattern: /config\.gorgias\.chat/i },
  { service: "Trustpilot", category: "marketing", handling: "visible", pattern: /widget\.trustpilot\.com/i },
  { service: "Yotpo", category: "marketing", handling: "visible", pattern: /staticw2\.yotpo\.com|cdn-widgetsrepository\.yotpo\.com/i },
  { service: "Judge.me", category: "marketing", handling: "visible", pattern: /cdn\.judge\.me/i },
  { service: "Loox", category: "marketing", handling: "visible", pattern: /loox\.io/i },
  { service: "Stamped", category: "marketing", handling: "visible", pattern: /cdn-stamped-io\.azureedge\.net|stamped\.io/i },
  { service: "YouTube embed", category: "preferences", handling: "visible", pattern: /youtube\.com\/embed|youtube-nocookie\.com/i },
  { service: "Vimeo embed", category: "preferences", handling: "visible", pattern: /player\.vimeo\.com/i },

  // --- Essential / exempt --------------------------------------------------
  { service: "Google reCAPTCHA", category: "essential", handling: "visible", pattern: /google\.com\/recaptcha|gstatic\.com\/recaptcha/i },
];

/**
 * App-embed names (the slug inside shopify://apps/<name>/blocks/…) that map
 * to a known service. Anything not matched is reported as an unknown embed
 * so the merchant can review it themselves.
 */
const APP_EMBED_SERVICES: { match: RegExp; service: string }[] = [
  { match: /google|gtag/i, service: "Google & YouTube channel" },
  { match: /tiktok/i, service: "TikTok" },
  { match: /meta|facebook/i, service: "Meta (Facebook)" },
  { match: /pinterest/i, service: "Pinterest" },
  { match: /klaviyo/i, service: "Klaviyo" },
  { match: /snap/i, service: "Snapchat" },
  { match: /microsoft|clarity/i, service: "Microsoft Clarity" },
  { match: /hotjar/i, service: "Hotjar" },
];

export function matchAppEmbedService(embedName: string): string | null {
  const hit = APP_EMBED_SERVICES.find((entry) => entry.match.test(embedName));
  return hit ? hit.service : null;
}
