# Consentinel — Project Status & Handoff

_Last updated: 2026-07-18 (session 3)._

## ⏸ SESSION-3 STOPPING POINT — resume here

-3. **NEWEST (2026-07-19 latest): competitor-parity round (0c2be0d), NOT
   deployed.** After researching Pandectes/Consentmo tiers: floating
   "Privacy choices" reopen pill (free + Appearance toggle,
   ShopSettings.showReopen + migration — closes the no-way-back-after-
   decision compliance gap), preferences prefilled from stored consent,
   Home 30-day consent stats (free; Consentmo charges $34), consent-log
   CSV export (Pro, /app/log.csv via App Bridge fetch + blob download),
   app name recased to "Consentinel" in the toml (fixes lowercase admin
   nav title; applies on deploy). Bundle 18741B / 6.9KB gzip, budget now
   ≤19KB. Harness-verified reopen→prefill→save→pill-returns loop.
   COMPETITOR ROADMAP (not built): banner translations/multi-language
   (both competitors gate by tier), cookie scanner (Phase 2), DSAR page,
   auto-generated privacy policies, accessibility widget (Consentmo
   differentiator), Meta/TikTok pixel integrations, IAB TCF.

-2. **NEWEST (2026-07-19 later): logo width + modal/card width + dirty-save
   + position-scoped width controls, NOT deployed.** ShopSettings.cardWidth
   (280–600, default 400) sizes the bottom-left/right cards; the Advanced
   styling section now shows ONLY the width control matching the selected
   position (bar select / modal field / card field). Harness-verified
   560px dark card with 140px side logo. PLUS mobile polish (merchant
   report "not professional on mobile"): side logos stack above the text
   ≤760px, logo capped at min(logoSize, 55vw) ≤520px, and body/heading/
   button fonts step down one notch (floor 13px) ≤520px — verified at 375px
   in the harness. Budget RESTATED to ≤18KB min; now 17754B / 6.6KB gzip
   (wire cost is what matters). logoSize reinterpreted as WIDTH px (text field, clamped
   20–200, migration resets existing rows to 120 — height now scales with
   the image, fixing the "logo looks small/cramped" report); new
   ShopSettings.modalWidth (text field, 320–720, default 460) drives the
   centered modal via width:min(${"{mw}"}px, 100vw-32px) so it stays
   responsive (≤520px bottom-sheet unchanged); Banner-settings Save button
   now grays out until the form differs from the saved loader state
   (formStateFrom baseline compare — revalidation after save re-disables
   it). Bundle 17405B min / 6.4KB gzip (≤17KB). Harness-verified 640px
   dark modal + 180px-wide logo. Restart dev server (new Prisma client)
   + deploy still required.

-1. **(2026-07-19): logo layout + image picker + billing return fix,
   NOT deployed.** (a) Logo size (24/36/48 select, clamped 20–60) and
   position (top/left/right of content) — new ShopSettings columns +
   `add_logo_layout` migration, storefront flex layouts, preview support;
   harness-verified left@48 dark bar + right@24 light card. (b) In-app logo
   image picker: hidden file input → POST /app/logo-upload
   (app/routes/app.logo-upload.tsx: stagedUploadsCreate → POST bytes →
   fileCreate → poll READY → CDN URL into the form). **REQUIRES the new
   `write_files` scope (shopify.app.toml changed from "")** — after deploy,
   re-open the app once so managed install grants it; merchant-tested
   upload still owed. (c) White screen after approving the test charge
   fixed: billing returnUrl now points at the embedded admin deep link
   (admin.shopify.com/store/{handle}/apps/{api-key}/app/plan) instead of
   the bare tunnel URL where App Bridge has no shop/host. (d) Billing now
   VERIFIED working after the merchant chose Public distribution in the
   Partner Dashboard; Pro features unlock. Bundle 17375B min / 6.5KB gzip
   (≤17KB budget).

0. **NEW (later in session 3): Advanced styling (Pro) + focus-ring fix,
   harness-verified, NOT deployed.** Merchant asked for width/font/border
   controls after seeing the deployed banner. Shipped: `bannerWidth`
   (contained 960px | full edge-to-edge, bottom bar only), `fontFamily`
   (system | theme — theme mode appends font-family:inherit after every
   font shorthand), `fontSize` + `buttonFontSize` (12–18px), `borderWidth`
   (0–3px, banner container only; buttons/cards keep 1px). New ShopSettings
   columns + migration `add_style_settings`; gate = `canUseAdvancedStyling`
   in billing.server.ts (free is forced to defaults in buildStorefrontConfig,
   UI disabled with upgrade hint, action ignores fields); clamps shared in
   types/consent.ts STYLE_LIMITS and re-clamped in the bundle. The "thick
   border" the merchant reported was the autofocus focus-visible ring —
   banner now focuses the panel (tabindex -1; trap patched so shift-Tab from
   the panel wraps) and the position label "Bottom bar (full width)" was
   renamed. Bundle budget RESTATED to ≤17KB min / ~6.2KB gzip (now 16933B /
   6375B) — the old 16KiB budget had zero headroom. Merchant still needs:
   `shopify app deploy`, then upgrade to Pro via TEST billing to try the
   new settings (SHOPIFY_BILLING_TEST defaults on → no real charge).

1. **Bottom-bar layout + checkbox fix VERIFIED in the harness (2026-07-18)**:
   dark bottom_bar main + Customize, light desktop, mobile 375px, US opt-out
   bar, center_modal + logo + scrim — all screenshot-checked. The harness
   also caught and we fixed four NEW theme-bleed leaks the hardening missed
   (`text-transform`/`text-decoration`/`font` not pinned on `.cstl-body a`,
   `.cstl-catrow`, `.cstl-cat b/small`; `transform` not reset on
   `.cstl-toggle` — a theme `input{transform:scale(2)}` doubled checkbox
   size), plus two mobile issues (buttons squeezed onto one row by `flex:1`
   basis-0 → "Accept all" wrapped to 2 lines; fixed with `flex:1 1 40%` +
   tighter padding under 520px) and added a double-click guard in
   submitConsent so rapid clicks can't write duplicate audit-log rows.
   Bundle 16368B min (just under the 16KiB budget — ~0 headroom left) /
   6.0KB gzip. Typecheck + lint clean. Committed.
2. **NOT YET DEPLOYED** (merchant runs
   `PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app deploy --allow-updates`
   from `consentinel/`): scrim rename, focus-ring fix, Pro logo feature,
   bottom-bar layout + checkbox fixes, theme-bleed leak fixes, mobile action
   layout, double-click guard.
3. Merchant tests owed after deploy: bottom-bar spacing + checkbox clarity
   on the real storefront (the original report), modal layout, consent-log
   row after a fresh accept, GCM dataLayer entries, billing upgrade/cancel
   flow, logo URL end-to-end (needs Pro).
4. Harness tip learned this session: cache-bust the bundle script tag
   (`consent-banner.js?v=<Date.now()>` via document.write) or the browser
   re-runs a stale cached bundle after rebuilds; the Claude-browser console
   reader duplicates every message (a single log line appears twice), and
   only ref-based/JS clicks land — raw coordinate clicks silently miss.

## Local banner harness (how to verify banner UI without the store)

Create a static page that stubs `window.__consentinel` (v2 config incl.
`regions`, `country`) and `window.Shopify.customerPrivacy` (all signals
false — also exercises local region resolution), simulates hostile theme CSS
(element selectors with letter-spacing/text-transform), loads
`extensions/consent-banner/assets/consent-banner.js`, serve with
`python3 -m http.server`, screenshot light/dark × opt_in/opt_out ×
positions × mobile in the Claude browser. Query params worth wiring:
`theme, position, country, accent, logo`.
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
