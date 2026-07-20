# Consentinel

Cookie-consent / GDPR compliance app for Shopify. Shows a customizable consent
banner on the storefront, genuinely blocks non-essential scripts until the
visitor consents, emits Google Consent Mode v2 signals, and keeps a PII-free
audit log of consent decisions — all built on Shopify's Customer Privacy API
(never raw cookie manipulation).

## Architecture

| Piece | Where | Notes |
| --- | --- | --- |
| Admin UI | `app/routes/app.*` | Embedded app, Polaris web components |
| Data layer | `prisma/schema.prisma`, `app/models/` | `ShopSettings`, `RegionRule`, `ConsentEvent` |
| Storefront banner | `app/storefront/consent-banner.ts` | Bundled by `npm run build:banner` into the theme app extension |
| Theme app extension | `extensions/consent-banner/` | App embed, `compliance_head` target (runs before other scripts) |
| Config delivery | `app/models/storefrontConfig.server.ts` | App-owned metafield `consentinel.banner_config` — zero storefront API calls |
| Consent logging | `app/routes/proxy.consent.tsx` | App proxy `/apps/consentinel/consent`, signature-verified |
| Privacy webhooks | `app/routes/webhooks.*` | The three mandatory topics + uninstall cleanup |
| Billing | `app/models/billing.server.ts`, `app/routes/app.plan.tsx` | Free vs Pro ($9/mo, 14-day trial) via the Billing API |

Key design decisions:

- **Customer Privacy API only.** Consent state is read and written through
  `window.Shopify.customerPrivacy`; the app never touches Shopify's own
  cookies. Opt-out signals are only ever sent on a real visitor interaction.
- **Pre-consent blocking is real.** The banner bundle loads parser-blocking in
  `compliance_head`, installs a script blocker and Google Consent Mode v2
  denied-by-default *before* any theme or app script runs.
- **The consent log stores no PII.** No IP, no user agent, no customer id —
  so the mandatory `customers/data_request` and `customers/redact` webhooks
  are honest no-ops (see the route comments).
- **Free plan is fully compliant.** Gating covers region-rule customization
  and branding removal, never the compliance features themselves.

## Local development

Requirements: Node ≥ 22.12 (engines allow ≥ 20.19), Shopify CLI ≥ 4.x, a
Partner org with a dev store.

```shell
npm install
cp .env.example .env   # SQLite defaults are fine for dev
npm run dev            # shopify app dev — tunnels, installs, hot-reloads
```

After editing `app/storefront/consent-banner.ts`, rebuild the extension asset:

```shell
npm run build:banner
```

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run build`,
`npm run setup` (prisma generate + migrate deploy).

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SHOPIFY_API_KEY` / `SHOPIFY_API_SECRET` | App credentials (CLI injects in dev) |
| `SHOPIFY_APP_URL` | Public app URL (CLI injects in dev) |
| `DATABASE_URL` | `file:dev.sqlite` in dev, PostgreSQL URL in production |
| `SHOPIFY_BILLING_TEST` | Billing test mode. **Defaults ON**; set `false` in production to charge real money |

## Production database: SQLite → PostgreSQL

SQLite is for local dev only (single file, no concurrent writers, lost on
ephemeral hosts). To switch:

1. In `prisma/schema.prisma`, change the datasource `provider` to
   `"postgresql"`.
2. Set `DATABASE_URL` to your Postgres connection string.
3. Regenerate migrations (the checked-in ones are SQLite dialect):
   delete `prisma/migrations/` and run
   `npx prisma migrate dev --name init` against a dev Postgres database.
4. Deploys run `npm run setup` (`prisma generate && prisma migrate deploy`).

The schema uses String pseudo-enums and no SQLite-specific types, so no model
changes are needed.

## Deployment

**For the full production launch (Render + Postgres), follow the step-by-step
runbook in [DEPLOY.md](DEPLOY.md).** A `render.yaml` Blueprint provisions the
web service + database in one step; `/healthz` is the platform health check.

Any Node host works. The included `Dockerfile` (Node 22, runs
`npm run setup && npm run start`) suits Render, Railway, and Fly out of the box:

- **Render/Railway**: create a Postgres instance, point `DATABASE_URL` at it,
  deploy the repo as a Docker service, set the env vars above.
- **Fly**: `fly launch` with the Dockerfile, attach Fly Postgres,
  `fly secrets set` the env vars.

Then update the Shopify app config for production:

1. `shopify app deploy` — releases the current config + extension version.
2. Set `application_url` and `[auth].redirect_urls` in `shopify.app.toml` to
   the production host (they hold dev placeholders while
   `automatically_update_urls_on_dev` is on).
3. Set `SHOPIFY_BILLING_TEST=false` when you're ready to charge merchants.

## Billing

- Plans: **Free** (compliant defaults, "Powered by" credit) and **Pro**
  ($9/month, 14-day trial: region-rule customization + branding removal).
- The Billing API is the source of truth; `ShopSettings.plan` is a cached
  copy reconciled on the home and plan page loaders
  (`app/models/billing.server.ts`).

## Mandatory privacy webhooks

Configured in `shopify.app.toml` under `[webhooks.privacy_compliance]`:

| Topic | Route | Behavior |
| --- | --- | --- |
| `customers/data_request` | `webhooks.customers.data_request.tsx` | 200 — no customer PII stored |
| `customers/redact` | `webhooks.customers.redact.tsx` | 200 — nothing customer-linked to erase |
| `shop/redact` | `webhooks.shop.redact.tsx` | Purges all shop rows (arrives 48h after uninstall) |

`app/uninstalled` deletes sessions immediately; everything else waits for
`shop/redact` so a quick reinstall keeps the merchant's settings.

Test locally with the dev server running:

```shell
shopify app webhook trigger --topic shop/redact --api-version 2026-10 \
  --delivery-method http --address <tunnel-url>/webhooks/shop/redact \
  --client-secret <SHOPIFY_API_SECRET>
```

Invalid HMACs are rejected with 401 (automated review checks this).

## Pre-submission

See [PRE_SUBMISSION_CHECKLIST.md](PRE_SUBMISSION_CHECKLIST.md) for the
Shopify app review and Built for Shopify checklist.
