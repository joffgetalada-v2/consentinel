# Consentinel — App Store listing draft

Working copy for the Shopify App Store listing. Fill the bracketed fields
before submission; character limits are Shopify's current ones — re-check
them in the Partner Dashboard listing editor when pasting.

## App name (30 chars max)

Consentinel — Cookie Consent

## Tagline / app introduction (100 chars max)

GDPR & CCPA cookie banner with real script blocking, Google Consent Mode
v2, and a cookie scanner.

## App details (500 chars max)

Consentinel keeps your store compliant without slowing it down. Visitors
from the EU/UK see an opt-in cookie banner; US privacy-law states get a Do
Not Sell/Share notice — automatically. Tracking scripts are genuinely
blocked until consent, Google tags honor Consent Mode v2, and every
decision lands in a PII-free audit log. Scan your store to see exactly
which trackers you run. Setup takes minutes: one theme embed, no code.

## Feature bullets (up to 5, 80 chars each)

1. Cookie scanner: see every tracker your store loads and how it's handled
2. Real pre-consent script blocking — not just a banner that hides cookies
3. Google Consent Mode v2 + Global Privacy Control honored, both included free
4. Region-aware: EU/UK opt-in, US states Do Not Sell/Share, auto-resolved
5. Data-request (DSAR) page and PII-free consent audit log with CSV export

## Pricing

- **Free** — Compliant banner, script blocking, Consent Mode v2, Global
  Privacy Control support, compliant region defaults, audit log, cookie
  scanner, customer data-request (DSAR) page + inbox.
- **Pro $9/mo, 14-day trial** — Region rule customization, your logo on the
  banner, advanced styling (widths/fonts/borders), banner translations
  (de/fr/es/it/nl/pt), CSV export, one-click cookie policy page generator,
  remove the "Powered by" credit.

## Screenshot shot list (1600×900 desktop, capture after deploy)

1. Storefront banner, light theme, bottom bar, desktop — hero shot.
2. Cookie scanner results page showing "N third-party services found" with
   the three handling groups. (Install driver — put this second.)
3. Banner settings with live preview, dark modal + logo (Pro flag on).
4. Home: checklist all-Done + 30-day consent stats.
5. Mobile storefront banner (375px, bottom sheet) — mobile-polish proof.
6. Region rules page (EU/UK opt-in, US states opt-out).

## Additional listing fields

- **App icon**: [1200×1200 PNG — needs design; shield + cookie motif]
- **Category**: Store management → Privacy / Legal (verify exact taxonomy
  in the dashboard).
- **Languages**: English (admin). Banner supports de/fr/es/it/nl/pt (Pro).
- **Demo store URL**: [optional — consent-dev is password-protected; decide
  whether to open a public demo store]
- **Support email**: [required — digital@motoronecx.com or a dedicated
  support@ address?]
- **Privacy policy URL**: [required for listing — where will it be hosted?]
- **App review notes**: billing uses test mode until launch
  (SHOPIFY_BILLING_TEST); privacy webhooks implemented (data_request /
  customers_redact no-op by design — the consent log stores no PII;
  shop_redact purges all shop data). Banner uses the Customer Privacy API
  only, never raw Shopify cookies.

## Keywords (for search field)

cookie consent, GDPR, CCPA, cookie banner, consent mode, privacy,
cookie scanner, script blocking, compliance
