# Consentinel — Project Status & Handoff

_Last updated: 2026-07-14 (session 2)._
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
      (embed block, currently `target: "head"`), bundle
      `app/storefront/consent-banner.ts` → `npm run build:banner` →
      `extensions/consent-banner/assets/consent-banner.js` (10.6KB min).
      Customer Privacy API (with boot-race retry loader), script blocker,
      GCM v2 defaults/updates, a11y banner + preferences modal, app proxy
      event logging (`/apps/consentinel/consent` → `app/routes/proxy.consent.tsx`),
      config via app-owned metafield (`consentinel.banner_config`, synced on
      settings/region saves).
      **PENDING: merchant's final storefront test results** (banner display,
      pre-consent blocking, GCM dataLayer, consent log rows). Everything is
      deployed as version consentinel-7.
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

- **Deploy pending**: session-2 changes (privacy webhooks config, scope trim
  to `scopes = ""`, demo metafield/metaobject definitions removed,
  `compliance_head` target restored) are code-complete but not deployed.
  Run `shopify app deploy` (will prompt; --force skips) and release.
  Scope trim may prompt a re-auth on next app open — expected.
- **After deploy, verify `compliance_head`**: the embed must still list in
  the theme editor's App embeds panel and the banner must still render.
  If it disappears, the fallback is reverting the target to `head`.
- Step 5 storefront test results still owed by merchant (banner display,
  pre-consent blocking, GCM dataLayer, consent log rows).
- Billing flow test owed by merchant: upgrade → approve test charge → Pro
  unlocks (regions editable, branding toggle) → cancel → downgrade forces
  branding back on.
- Storefront region logging is coarse (mode only, region often null) — decide
  whether to enrich (e.g., via `Shopify.country` heuristics) or document.
- Both banners can appear (ours + Shopify's native cookie banner) now that
  cookie-banner regions are configured — verify and disable the native banner
  display if it shows (Settings → Customer privacy → Cookie banner).
- Consider APP_SUBSCRIPTIONS_UPDATE webhook for instant plan-cache sync
  (currently reconciled on app-open; fine for review).

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
