# Consentinel — Project Status & Handoff

_Last updated: 2026-07-20 (session 4)._

## ⏸ SESSION-4 STOPPING POINT — resume here

0. **Session-3 batch DEPLOYED + MERCHANT-VERIFIED (2026-07-20), no issues.**
   Everything from the session-3 stopping point passed on the real store:
   app title "Consentinel", advanced styling (widths/fonts/borders), logo
   image picker + width/position, mobile polish, "Privacy choices" reopen
   pill + prefilled preferences, Home embed detection + 30-day stats, CSV
   export, translations, billing. Scopes "read_themes,write_files" granted.
   Banner bundle 19101B min / 6.9KB gzip (≤19KB budget, nearly full — trim
   or bump before ANY new storefront-bundle feature). Still owed from
   before (needs EU VPN): fresh accept → consent-log row + GCM dataLayer
   entries.

1. **NEW (2026-07-20): launch-prep batch — built, typecheck/lint/build
   clean, smoke-tested, NOT DEPLOYED, NOT merchant-tested.**
   - **Cookie scanner** (the "we found N trackers" install driver; zero
     storefront-bundle impact — fully server-side).
     `app/models/trackerCatalog.server.ts`: ~45 known services with
     `handling` = blocked | consent_mode | visible — the blocked list MUST
     STAY IN SYNC with TRACKER_PATTERNS in
     app/storefront/consent-banner.ts. `app/models/scanner.server.ts`:
     fetches rendered home + one product page (gracefully skips to
     theme-only when the storefront is password-protected — the dev store
     ALWAYS is, so expect the in-UI notice there), plus layout/theme.liquid
     and settings_data.json app embeds via read_themes. Results upserted
     latest-per-shop in new `ScanResult` model (migration
     `add_scan_result`). UI: /app/scanner (+ nav link) grouped by handling,
     Home aside teaser card with tracker count. Catalog patterns
     smoke-tested against a fixture incl. a false-positive check.
   - **APP_SUBSCRIPTIONS_UPDATE webhook** (toml + route +
     `applySubscriptionUpdate` in billing.server.ts): instant plan-cache
     sync on approve/cancel/decline/frozen; PENDING is a no-op; any
     downgrade restores branding; resyncs the config metafield.
   - **afterAuth hook** in shopify.server.ts: first install now seeds
     settings + region rules and writes the banner_config metafield —
     closes the long-standing "fresh install shows no banner until first
     Save" gap.
   - **SHOP_REDACT purge fix**: BannerTranslation (added session 3 but
     NEVER added to the purge — real compliance gap) and ScanResult now
     deleted in the redact transaction.

2. Merchant steps owed: restart dev server from an interactive terminal
   (new migration `add_scan_result` → new Prisma client), then
   `shopify app deploy --allow-updates` (the toml webhook change requires
   a deploy). Then test: /app/scanner on the dev store (expect the
   password-protected notice; findings come from theme + app embeds),
   Home scanner card, first-install flow if convenient (reinstall on a
   scratch store → banner config exists immediately), plan upgrade/cancel
   → plan flips without reopening the app (webhook working).

3. Remaining before App Store submission: production hosting + Postgres
   switch (needs merchant decision — Render/Railway/Fly are documented in
   README), App Store listing assets (copy draft in LISTING.md), EU-VPN
   spot checks above, and a final pass over PRE_SUBMISSION_CHECKLIST.md.

**Session-3 history (all now deployed + verified):** competitor-parity round
(reopen pill, prefilled prefs, 30-day stats, CSV export, name recase),
banner translations de/fr/es/it/nl/pt (Pro) + real embed detection
(read_themes), logo width/position + image picker (write_files) +
modal/card widths + dirty-save, mobile polish, advanced styling (Pro) +
focus-ring fix, bottom-bar layout + checkbox fixes + theme-bleed
hardening + double-click guard. Billing verified (test mode; Public
distribution chosen). Roadmap ideas not built: DSAR page, auto privacy
policy, accessibility widget, Meta/TikTok pixel integrations, IAB TCF,
weekly stats email.

## Local banner harness (how to verify banner UI without the store)

Create a static page that stubs `window.__consentinel` (v2 config incl.
`regions`, `country`) and `window.Shopify.customerPrivacy` (all signals
false — also exercises local region resolution), simulates hostile theme CSS
(element selectors with letter-spacing/text-transform), loads
`extensions/consent-banner/assets/consent-banner.js`, serve with
`python3 -m http.server`, screenshot light/dark × opt_in/opt_out ×
positions × mobile in the Claude browser. Query params worth wiring:
`theme, position, country, accent, logo`.
Gotchas: cache-bust the bundle script tag
(`consent-banner.js?v=<Date.now()>` via document.write) or the browser
re-runs a stale cached bundle after rebuilds; the Claude-browser console
reader duplicates every message (a single log line appears twice); only
ref-based/JS clicks land — raw coordinate clicks silently miss.
Cookie-consent / GDPR compliance Shopify app ("Built for Shopify"-ready MVP).
Full product spec lives in the original kickoff prompt; key constraints: Customer
Privacy API only (never raw Shopify cookies), theme app extension embed for the
banner, genuine pre-consent script blocking, Google Consent Mode v2, Polaris
(web components) admin, GraphQL Admin API only, Billing API monetization.

## Progress (working method steps 1–8)

- [x] **1. Environment** — verified + repaired (see Environment quirks below).
- [x] **2. Scaffold** — official `shopify-app-template-react-router` (TS).
      App `consentinel`, client_id `c745ec58d125629b390eb4d4a33fe529`,
      org **Joff Storefront**, dev store `consent-dev.myshopify.com`.
      Confirmed running + installed.
- [x] **3. Data layer** — Prisma models `ShopSettings`, `RegionRule`,
      `ConsentEvent` (+ template `Session`); model modules in `app/models/`;
      shared types in `app/types/consent.ts`; `DATABASE_URL` env-driven
      (SQLite dev → Postgres switch documented in `prisma/schema.prisma`).
- [x] **4. Admin UI (Polaris web components)** — Home (onboarding checklist +
      one-click embed deep link), Banner settings (live preview), Region rules,
      Consent log. All tested by merchant.
- [x] **5. Storefront banner** — theme app extension `consent-banner`
      (embed block, `target: "compliance_head"` — verified listing + rendering
      after the 2026-07-14 deploy), bundle
      `app/storefront/consent-banner.ts` → `npm run build:banner` →
      `extensions/consent-banner/assets/consent-banner.js` (10.7KB min).
      Customer Privacy API (with boot-race retry loader), script blocker,
      GCM v2 defaults/updates, a11y banner + preferences modal, app proxy
      event logging (`/apps/consentinel/consent` → `app/routes/proxy.consent.tsx`),
      config via app-owned metafield (`consentinel.banner_config`, synced on
      settings/region saves).
      **VERIFIED 2026-07-14**: banner displays on the storefront, config
      delivered, consent decision persists (no re-prompt on reload — by
      design). Debug learnings: Brave Shields' cookie-notice filter hides
      consent banners entirely (fail-closed = compliant, but test with
      Shields off or another browser); once any banner records a decision,
      ours stays hidden until `_tracking_consent` is cleared.
      Remaining step-5 spot checks: consent-log row appears after a fresh
      accept/reject, GCM dataLayer entries, script-blocker release.
- [x] **6. Compliance webhooks** — routes for CUSTOMERS_DATA_REQUEST,
      CUSTOMERS_REDACT (both honest no-ops: the consent log stores no PII),
      SHOP_REDACT (purges all shop rows in a transaction; APP_UNINSTALLED
      still only deletes sessions so a 48h reinstall keeps settings).
      Configured in `shopify.app.toml` [webhooks.privacy_compliance].
      **Verified end-to-end** via `shopify app webhook trigger` against the
      dev tunnel: all three 200 with correct log lines, SHOP_REDACT purged
      seeded rows, invalid HMAC → 401. **NOT YET DEPLOYED** (needs
      `shopify app deploy`, which requires user approval/run).
- [x] **7. Billing API** — Pro plan $9/mo USD, 14-day trial
      (`PRO_PLAN*` consts in app/shopify.server.ts; test mode defaults ON,
      controlled by SHOPIFY_BILLING_TEST). New /app/plan page
      (upgrade via navigation submit → billing.request redirect; cancel;
      Pro-only branding toggle). Plan cache reconciled with billing.check
      in home + plan loaders (app/models/billing.server.ts).
      Gating: free = compliant region defaults locked (customization is
      Pro) + forced branding — enforced in regions action, plan action,
      and buildStorefrontConfig. **PENDING: merchant billing-flow test.**
- [x] **8. Pre-submission checklist + README** — README.md rewritten
      (architecture, env vars, SQLite→Postgres, Render/Railway/Fly deploy);
      PRE_SUBMISSION_CHECKLIST.md tracks review + Built for Shopify items.
      Dockerfile bumped node:20→22.

## Known follow-ups / open items

- **BILLING BLOCKED until the merchant picks a distribution method** (found
  2026-07-18): appSubscriptionCreate returns "Apps without a public
  distribution cannot use the Billing API". Fix: Partner Dashboard → Apps →
  consentinel → Distribution → choose **Public distribution** (correct for
  an App Store app; the choice is permanent). Billing errors now surface as
  a toast on the Plan page instead of a crash (d876f6d).

- **RESOLVED (2026-07-14): native banner + region coupling.** Merchant
  disabled Shopify's native banner (Cookie banner → Regions → "Not visible
  in any region" — that IS the off switch; there's no separate toggle),
  which also silenced `shouldShowBanner()` and hid OUR banner. Fixed by
  making the storefront resolve regions itself (v2 config): enabled region
  rules ship in the metafield, visitor country comes from
  `localization.country` in the embed Liquid, and the script merges its own
  resolution with Shopify's signals (either can trigger). US visitors map to
  any enabled US-* rule (opt_out wins on mixed modes) since states can't be
  resolved client-side. Also added: `?consentinel_preview=1` preview mode
  (force-renders, clicks dismiss without recording) and region codes
  (EU/UK/US) in logged consent events. "Not visible in any region" is now
  the CORRECT permanent setting for the native banner.
  **Needs: `shopify app deploy` + one Save in Banner settings to write the
  v2 metafield (regions array).**
- Billing flow test owed by merchant: upgrade → approve test charge → Pro
  unlocks (regions editable, branding toggle) → cancel → downgrade forces
  branding back on.
- Step-5 spot checks owed: consent-log row after a fresh accept/reject, GCM
  dataLayer entries, script-blocker release on consent.
- **Banner redesign + geo accuracy (2026-07-14 later session, verified in a
  local harness with screenshots — light/dark, opt-in/opt-out, modal,
  preferences view, mobile)**: hardened every banner element against theme
  CSS bleed (explicit font/color/letter-spacing; fixes dark-theme heading
  rendering theme-dark and the theme's letter-spacing leaking into links),
  polished the design to native-banner quality (radius 16, layered shadow,
  hover states, backdrop blur on modal overlay, mobile bottom-sheet
  behavior), animation is opacity-only (transform used to fight modal
  centering). Visitor country now comes from
  `/browsing_context_suggestions` IP geolocation (1.5s timeout →
  `localization.country` fallback — the market country wrongly reports the
  primary market for visitors outside all markets, e.g. PH visitor on a
  US-market store looked like US and got the opt-out banner).
  `?consentinel_preview=1` now always previews the customizable opt-in
  banner; `=opt_out` previews the US variant. Modal overlay confirmed
  working in the harness — its absence in the merchant's Brave screenshot
  was browser-side.
- v2 metafield confirmed live in production: the banner displayed via local
  region resolution with the native banner fully disabled.
- **Modal backdrop mystery SOLVED**: the dim layer was hidden client-side by
  adblock annoyance lists matching the class name `cstl-overlay` (harness
  rendered it fine). Renamed to `cstl-scrim` — never name storefront
  elements "overlay"/"backdrop"/"cookie". Focus ring switched to
  currentColor (accent-colored ring was invisible on dark).
- **Merchant logo on banner (Pro)** shipped 2026-07-15: `ShopSettings.logoUrl`
  (+ migration `add_logo_url`), Banner-settings "Logo URL" field (disabled on
  free with upgrade hint; server ignores the field on free), forced null in
  storefront config on free (`canUseLogo` in billing.server.ts is the one
  place to change the gating), rendered above the heading (36px cap) in
  banner + admin live preview + Pro plan-page bullet. Merchants upload via
  Content → Files and paste the URL. Verified in the harness (dark modal +
  scrim + logo screenshot). Bundle now 14.4KB (<15KB budget).
- Embedded admin currently shows "refused to connect": application_url
  points at a dead tunnel (a failed non-interactive dev-server start updated
  the URL before dying at the storefront-password prompt). Fix: run
  `shopify app dev` from an interactive terminal.
- Fresh installs that never hit Save have no config metafield; with the
  native banner off, the script's fallback signals are silent → no banner
  until first save. Follow-up: sync the metafield on install/first app open.
- **Dev quirks (2026-07-14)**: (a) `shopify app deploy` pushes the toml's
  placeholder `application_url` (example.com), breaking the embedded admin
  until the dev server restarts and re-patches the URL. (b) The CLI 4.5.0
  upgrade dropped the cached storefront password — `shopify app dev` now
  prompts for it, so it must be started from an interactive terminal once
  to re-cache.
- Consider APP_SUBSCRIPTIONS_UPDATE webhook for instant plan-cache sync
  (currently reconciled on app-open; fine for review).
- Deployed 2026-07-14 by merchant: privacy webhooks config, scopes = "",
  demo definitions removed, compliance_head target (all released).

## Environment quirks (this machine)

- **Shopify CLI**: use `~/.npm-global/bin/shopify` (now v4.5.0 — it
  auto-upgraded itself mid-session on 2026-07-14) by full path — the
  `shopify` on PATH is a stale brew 3.84.1. CLI auth sessions expire; deploys
  may trigger browser re-login.
- Non-TTY workaround: `script -q <logfile> <command>` fakes a TTY and is
  simpler than expect for commands that just need prompt-free output.
- **Node**: project needs ≥22.12. Use keg-only brew node@22:
  `PATH="/usr/local/opt/node@22/bin:$PATH"` prefix for npm/shopify commands.
- **Dev server**: `cd consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com`
  (storefront password is cached by the CLI; store password page protection
  cannot be disabled on this dev store).
- Interactive CLI prompts don't work in non-TTY shells — Claude runs them via
  `expect` scripts.
- After adding a NEW extension type: **reinstall the app on the dev store** or
  the theme editor's App-embeds panel won't list it.
- Theme editor deep links: `activateAppId={SHOPIFY_API_KEY}/{block-handle}`
  (client id, not extension uuid).
- Rebuild the storefront bundle after editing `app/storefront/consent-banner.ts`:
  `npm run build:banner` (esbuild), then `shopify app deploy --allow-updates`
  for released versions.
