# Phase 0 — Architecture Discovery

_Written 2026-07-30. Read-only discovery for the consent-revenue-optimization mission
(Phases 1–6). No code changes in this phase._

Location note: the mission asks for `docs/plans/`. The repo had no `docs/` directory —
existing docs (PROJECT_STATUS.md, DEPLOY.md, …) are top-level files in the app root
`consentinel/`. This directory (`consentinel/docs/plans/`) was created for the phased
plan docs, keeping them beside the rest of the project docs.

## 1. Stack

| Concern | What's used |
|---|---|
| Framework | React Router 7 (Remix successor) via `@shopify/shopify-app-react-router` 1.1.0; loaders/actions return plain objects (no `json()` wrapper) |
| DB / ORM | Prisma 6 + SQLite locally (`prisma/schema.prisma`, `datasource provider = "sqlite"`); production target is Render Postgres 16 (`render.yaml` at app root — web service + `consentinel-db`, no cron service defined yet) |
| Admin UI | Polaris **web components** exclusively (`s-page`, `s-section`, `s-banner`, `s-table`, …) — NOT `@shopify/polaris` React. Toasts via `useAppBridge().toast.show` |
| Storefront | Theme app extension `extensions/consent-banner`, single liquid block targeting `compliance_head`, deliberately parser-blocking script |
| Banner build | `npm run build:banner` → esbuild bundles `app/storefront/consent-banner.ts` (1053 lines, zero deps) → `extensions/consent-banner/assets/consent-banner.js` |
| Tests | **None.** No runner, no config, no test files. Only `lint` (eslint 8 legacy config) and `typecheck` (`react-router typegen && tsc --noEmit`) |
| Scheduled jobs | **None.** No cron/queue/worker anywhere. `consentEvents.server.ts:8` has a comment reserving it as the home for "retention auto-purge" |
| Hosting | Render blueprint (`render.yaml`): Docker web service, `/healthz` health check, `SHOPIFY_BILLING_TEST=false` in prod. Render supports `type: cron` services — the natural home for a retention job |

## 2. Banner embed: build & serve pipeline

- **Config transport is an app-owned metafield, zero fetches**: the liquid block inlines
  `window.__consentinel = { config: {{ app.metafields.consentinel.banner_config.value | json }},
  country, locale, proxyUrl: "/apps/consentinel/consent" }`. The metafield is written by
  `app/models/storefrontConfig.server.ts` (`buildStorefrontConfig` + `syncStorefrontConfig`,
  metafieldsSet on `currentAppInstallation`, namespace `consentinel`, key `banner_config`)
  on every relevant admin save and on plan change.
- `buildStorefrontConfig` is also a **server-side plan gate**: on free plan it forces
  advanced-styling defaults, nulls `logoUrl`, and omits the `i18n` map.
- Client boot order in `consent-banner.ts`: GCM v2 defaults (all denied,
  `wait_for_update: 500`) → script blocker (regex `TRACKER_PATTERNS` per category,
  MutationObserver + `document.createElement` patch; Google tags deliberately not
  blocked — governed by Consent Mode) → Customer Privacy API bootstrap
  (`Shopify.loadFeatures` polling, fails **closed**) → `detectCountry()`
  (`/browsing_context_suggestions` IP-geo, liquid country fallback after 1.5s) →
  `start(api, country)` decides opt-in banner / opt-out banner / nothing.
- Region resolution: `regionFamilyForCountry` (EU list / GB→UK / US→US) matched against
  merchant `config.regions` rules. US state is not resolvable client-side, so any
  enabled `US-*` rule applies to all US visitors; `opt_out` wins on mixed modes.
- GPC: `navigator.globalPrivacyControl` in an opt-out region triggers a silent
  `gpc_opt_out` submission, no banner.
- Preview mode: `?consentinel_preview=1|opt_in|opt_out` force-renders; `IS_PREVIEW`
  short-circuits both `setTrackingConsent` and the audit log.
- **Storage inventory (complete)**: one localStorage key, `consentinel:vt` (random
  visitor token). No sessionStorage, no first-party cookies. Consent state lives
  exclusively in Shopify's Customer Privacy API.
- **Bundle size (Phase-6 baseline)**: `consent-banner.js` = **19,233 bytes minified /
  7,095 bytes gzipped**. Header comment states a ≤19KB min / ~7KB gz budget — we are
  ~at the ceiling; Phase 3's embed logic must be measured and the budget consciously
  revised in the plan doc if it must grow.

## 3. Consent event recording (current)

### Flow
`submitConsent()` (client) → `api.setTrackingConsent` → on success `logEvent()` →
`fetch(proxyUrl, { method: "POST", keepalive: true })` fire-and-forget →
`app/routes/proxy.consent.tsx` action → `authenticate.public.appProxy` (HMAC; shop
identity always from verified session, never payload) → `recordConsentEvent()` →
`prisma.consentEvent.create`.

- Valid signature but uninstalled shop → 204, nothing recorded.
- No rate limiting, no dedup, no anti-flood anywhere on this path (DataRequest, by
  contrast, has DB-count rate limiting — the in-repo pattern to reuse).
- Model treats input as hostile: enum guards (`isConsentMode` / `isConsentAction` →
  throw `Response(400)`), length caps (region ≤16, visitorToken ≤64 — over-length
  silently nulled, event still recorded).

### Exact current ConsentEvent schema (prisma/schema.prisma)

```prisma
model ConsentEvent {
  id        String   @id @default(cuid())
  shop      String
  createdAt DateTime @default(now())

  region String? // visitor's region group at decision time, if resolvable
  mode   String  // opt_in | opt_out — which consent model the banner ran in
  action String  // accept_all | reject_all | custom | sale_opt_out (+ gpc_opt_out in types)

  // Category outcomes. "Necessary" is always granted so it isn't stored.
  preferences Boolean @default(false)
  analytics   Boolean @default(false)
  marketing   Boolean @default(false)
  // Only meaningful in opt-out regions; null in opt-in regions.
  saleOfDataOptedOut Boolean?

  visitorToken String?

  @@index([shop, createdAt])
}
```

Client POST payload today: `{ mode, action, categories: {preferences, analytics,
marketing}, saleOfDataOptedOut: boolean|null, visitorToken, region }`.

**Gaps vs Phase 1 requirements**: no impressions (denominator), no `dismissed` action,
no device class, no banner variant id, no page type, no time-to-decision, no record of
which consent model was *shown* beyond `mode`. All existing rows must keep working —
new fields must be nullable/defaulted.

Shared enums/guards live in `app/types/consent.ts` (dependency-free by design; consumed
by admin, server, and the storefront bundle): `CONSENT_MODES`, `CONSENT_ACTIONS`
(`accept_all | reject_all | custom | sale_opt_out | gpc_opt_out`), `REGION_GROUPS`
(EU, UK, US-CA/VA/CO/CT/UT/TX/OR/MT with default modes), `STYLE_LIMITS` + `clampStyle`,
type guards (`isConsentMode`, `isConsentAction`, `isHexColor`, …).

## 4. Free/Pro plan state & gating

- Source of truth: Shopify Billing API. Cache: `ShopSettings.plan` (`"free" | "paid"`)
  + `subscriptionId`. Constants in `app/shopify.server.ts`: `PRO_PLAN = "pro"`, $9/mo,
  14-day trial, `BILLING_TEST_MODE` on unless `SHOPIFY_BILLING_TEST === "false"`.
- Reconciliation: `syncPlanFromBilling(billing, admin, shop)` runs in the **home and
  plan page loaders**; `applySubscriptionUpdate` handles the
  `APP_SUBSCRIPTIONS_UPDATE` webhook. Downgrade forcibly restores `showBranding = true`
  and re-syncs the storefront metafield. All other routes read the cached plan via
  `getShopSettings`.
- Capability helpers in `app/models/billing.server.ts` (all `plan === "paid"`):
  `canEditRegionRules`, `canRemoveBranding`, `canUseLogo`, `canUseAdvancedStyling`,
  `canGeneratePolicy`. Two features gate on raw `settings.plan === "paid"` instead
  (translations, CSV export) — new features should prefer named helpers.
- **Gating pattern (must replicate)**: loader exposes a boolean (`canExport`, `canEdit`…)
  → UI disables control + shows upsell → action/resource route re-checks server-side
  (403 or error message, or conditional-spread so gated fields never persist).
  Deliberate policy: plan limits must never force a non-compliant banner (all regions
  seed enabled on free).
- Upsell UI patterns: (a) `s-banner tone="info" heading="… is a Pro feature"` with
  `s-link href="/app/plan"`; (b) disabled control + `s-text color="subdued"`
  "Pro feature — upgrade on the Plan page …"; (c) button label swap
  (`"Export CSV (Pro)"`). Upgrade must use a **navigation** submit (`useSubmit`), not a
  fetcher — `billing.request` throws a redirect out of the iframe.

## 5. Admin routes, nav, UI conventions

Nav (`app/routes/app.tsx`, `<s-app-nav>` order): Home `/app` · Cookie scanner
`/app/scanner` · Banner settings `/app/settings` · Translations `/app/translations` ·
Region rules `/app/regions` · Consent log `/app/log` · Data requests `/app/requests` ·
Plan `/app/plan`. Every route exports the `boundary.headers` helper; `app.tsx` exports
the shared ErrorBoundary.

Conventions to match:
- Loader: `authenticate.admin(request)` → model calls in `Promise.all` → plain object.
- Mutations: `useFetcher`, `isSaving = fetcher.state !== "idle"`, toast on success,
  inline `{field, message}[]` errors from validation functions.
- Web-component boolean attrs via conditional spread: `{...(x ? { disabled: true } : {})}`.
- Empty state: `s-banner tone="info"` inside an `s-section` (see `app.log.tsx`).
- Dates: no date library. Audit surfaces = UTC ISO (`toISOString().replace("T", " ")`),
  casual surfaces = `toLocaleDateString()`. Relative windows via `Date.now() - n*86400e3`.
- CSV export: resource route (`app.log[.]csv.tsx`) with plan gate returning 403;
  client fetches with App Bridge session token and downloads via Blob URL. Buffered,
  `EXPORT_LIMIT = 10000`, manual `csvField()` escaping.
- Consent log table: `s-table`, badge-per-action map (`ACTION_LABELS`), 50/page
  Previous/Next pagination through `useSearchParams`.
- `BannerPreview` (`app/components/BannerPreview.tsx`): pure presentational, fully
  prop-driven (all banner fields as required props) — two instances side-by-side is the
  natural A/B variant preview. Callers pass plan-gated fallbacks themselves.
- Every route/model file opens with a JSDoc block stating purpose/rationale; copy is
  plain and honest (no hype).

## 6. Data layer conventions

- `app/db.server.ts`: standard global-singleton PrismaClient, default export.
- One model file per table with re-exported Prisma type. All queries scope by `shop`;
  tenant-safe mutation via `updateMany/deleteMany({ where: { id, shop } })`.
- Create/seed-on-first-read: `getShopSettings` upserts; `getRegionRules` seeds from
  `REGION_GROUPS` (idempotent under races via unique constraint).
- Validation styles by audience: merchant admin input → `{field, message}[]` arrays;
  programmatic/malformed → `throw new Response(400)`; public storefront input →
  result-code strings (`"created" | "duplicate" | "invalid" | "rate_limited"`) + clamp/drop.
- Pseudo-enums are TS `as const` arrays + `is*` guards; DB columns plain TEXT (SQLite
  has no enums; kept portable for Postgres switch).
- Migrations: 14 so far, Prisma-generated (`prisma migrate dev`), timestamped
  `snake_case` names, small/additive, never hand-edited. `migration_lock.toml` says
  sqlite — the Postgres switch (planned per render.yaml) will need regenerated or
  baselined migrations; new migrations in Phases 1–6 must stay additive/reversible and
  avoid SQLite-only constructs where possible.
- Privacy plumbing: `SHOP_REDACT` purges all seven tables per shop in one transaction;
  `CUSTOMERS_REDACT` deletes DataRequest rows by email (consent log holds no
  customer-linked data). **Any new table keyed by shop must be added to the
  `webhooks.shop.redact.tsx` transaction.**

## 7. Scanner (current) — Phase 5 baseline

- Two static passes in `runScan` (`app/models/scanner.server.ts`): rendered storefront
  fetch (home + first product page, 8s timeout, custom scanner UA) and theme source via
  Admin GraphQL (`layout/theme.liquid` + `config/settings_data.json`, works behind
  storefront passwords). No JS execution, raw regex over text.
- Signature list already exists as a single data file: `trackerCatalog.server.ts` —
  46 `TrackerCatalogEntry` rows (`{ service, category, handling, pattern }`) covering
  Meta/TikTok/Pinterest/Snap/Google Ads (blocked), GTM/GA4 (consent_mode),
  Klaviyo/Hotjar/Clarity in various states, + `APP_EMBED_SERVICES` name-map (8 entries).
  **Stated invariant: `handling: "blocked"` entries must stay in sync with
  `TRACKER_PATTERNS` in `consent-banner.ts`.**
- `category: "unknown"` is currently produced only for unmatched app embeds; unmatched
  page scripts are silently not reported — Phase 5's "flag unknown scripts prominently"
  changes this.
- Results persist as latest-per-shop upsert (`ScanResult`, JSON strings), UI groups by
  handling (blocked / consent_mode / visible-review).
- Password-protected messaging (keep): "Your online store is password-protected, so the
  rendered pages couldn't be fetched — these results come from your theme code and app
  embeds. Run the scan again once the store is public for full coverage."

## 8. Implications for Phases 1–6 (recorded, not yet planned in detail)

1. **Phase 1** extends `ConsentEvent` with nullable columns + adds an impression path.
   Natural hook: `renderBanner()` right after banner-root append (guard `IS_PREVIEW`).
   The app-proxy route is the only storefront→server channel; impressions ride it too
   (sampling/batching decided in the Phase 1 plan). Rollup table + retention job are
   new infrastructure; Render cron or an on-request sweep are the candidate triggers.
2. **Phase 2/4** read rollups, not raw events. Charting: nothing in the repo — plan
   calls for inline SVG.
3. **Phase 3** variant config can ride the existing `banner_config` metafield (zero
   extra requests); assignment seed: hash of existing `consentinel:vt` localStorage
   token, sessionStorage fallback pre-consent — never a cookie. Embed budget is the
   binding constraint (~220B headroom today; budget revision must be explicit).
4. **Phase 1 test setup**: repo has no runner; Vitest is the lightest fit for
   Vite 6 + TS already in the stack (dev-dependency only, no config sprawl).
5. **New tables** must join the SHOP_REDACT transaction and follow shop-scoped,
   pseudo-enum, create-on-first-read conventions.
6. **Gating**: new Pro features should get named `can*` helpers in `billing.server.ts`
   and the dual-layer (UI + server) gate pattern.

## OUTCOME

Shipped: this document (discovery only, no code changes).
Deferred: nothing — Phase 1 planning starts next.
Assumptions: `docs/plans/` placed in the app root beside existing project docs;
bundle-size baseline recorded from the committed asset (19,233 B min / 7,095 B gz).
