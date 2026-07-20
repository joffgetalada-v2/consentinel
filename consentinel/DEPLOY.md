# Production deploy runbook (Render + PostgreSQL)

Step-by-step to take Consentinel from dev (SQLite on a tunnel) to a
production host, before App Store submission. Recommended host: **Render**
(~$14/mo: $7 web service + $7 Postgres). The repo already ships a Dockerfile
and `render.yaml` blueprint.

## Phase A — you: create the Render database (needed before migrations)

1. Sign up at https://render.com and connect your GitHub account.
2. New → **Blueprint** → pick the `consentinel` repo. Render reads
   `render.yaml` and proposes a web service + a Postgres database.
   (Or create just the Postgres first: New → Postgres, plan **Basic-256mb**.)
3. Once the database is live, open it and copy its **External Connection
   String** (starts `postgres://…`). Paste it to Claude for Phase B.
   - External (not Internal) so migrations can be generated from this machine.

## Phase B — Claude: regenerate migrations for Postgres

The checked-in migrations are SQLite dialect and won't run on Postgres.
With the connection string, Claude will:

1. Switch `prisma/schema.prisma` datasource provider to `postgresql`.
2. Delete `prisma/migrations/` (SQLite history) and regenerate a fresh
   `init` migration against the Render database.
3. Typecheck + build to confirm the client still matches, commit the change.

Result: the same schema, now Postgres-native. No model changes — the schema
uses only portable types.

## Phase C — you: configure and deploy the web service

1. In the Render web service, set env vars (Blueprint leaves secrets blank):
   - `DATABASE_URL` — the database's **Internal** connection string
     (Render wires this automatically if you used the Blueprint).
   - `SHOPIFY_API_KEY` — from the Partner Dashboard (app → API credentials).
   - `SHOPIFY_API_SECRET` — same place. **Secret — never commit.**
   - `SHOPIFY_APP_URL` — your Render URL, e.g.
     `https://consentinel.onrender.com`.
   - `SCOPES` = `read_themes,write_files,write_online_store_pages`
   - `SHOPIFY_BILLING_TEST` = `false` (real charges) — or keep `true` until
     you've done one real end-to-end test.
2. Deploy. The Docker image runs `npm run setup` (`prisma migrate deploy`)
   then starts the server. Watch the logs for a clean migrate + boot.
3. Confirm `https://<your-render-url>/healthz` returns `ok`.

## Phase D — you: point Shopify at production

1. In the Partner Dashboard (or `shopify.app.toml`) set:
   - `application_url` = the Render URL
   - `[auth].redirect_urls` = `https://<render-url>/api/auth`
   - `[app_proxy].url` = `https://<render-url>/proxy`
   These hold dev placeholders while `automatically_update_urls_on_dev` is on;
   for production you may want to set that flag to `false` so a later
   `shopify app dev` doesn't overwrite the production URL.
2. Run `PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app deploy`.
3. Reinstall the app on `consent-dev` against the production URL; accept the
   permission prompt. Verify: banner loads on the storefront, admin opens,
   a test consent event lands in the log, the DSAR form works, and (on Pro)
   the policy generator writes a page.

## Phase E — before flipping billing to live

- Do one real upgrade with `SHOPIFY_BILLING_TEST=true` still set to confirm
  the flow, then set it to `false` and redeploy.
- Remember: with a real Postgres, every future schema change means a
  migration that `prisma migrate deploy` applies on the next deploy — keep
  migrations backward-compatible (old code briefly runs against new schema).

## Rollback

- Render keeps previous deploys — "Rollback" in the dashboard reverts the
  web service instantly.
- The database is unaffected by a web rollback; only a bad migration touches
  it, so review migration SQL before deploying schema changes.
