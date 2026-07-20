# Copy-paste prompt to resume the Consentinel build

Copy everything between the lines into a fresh Claude Code session opened in
`~/Documents/github/consentinel`.

---

We're continuing "Consentinel", a production-quality cookie-consent/GDPR
compliance Shopify app (React Router template, TypeScript, Prisma, Polaris web
components, theme app extension with pre-consent script blocking + Google
Consent Mode v2, Customer Privacy API only — never raw Shopify cookies).

START HERE:
1. Read consentinel/PROJECT_STATUS.md top to bottom — the "SESSION-4 STOPPING
   POINT" section at the top says exactly where we stopped, and the file has
   all environment quirks for this machine (which shopify CLI binary and
   node@22 PATH prefix, the local banner-test harness recipe + its
   cache-busting/click gotchas). Also read DEPLOY.md (production runbook) and
   COMPETITORS.md (roadmap) — both are in the consentinel/ folder.

2. State at end of session 4 (2026-07-20): the session-3 batch and the
   launch-prep batch (cookie scanner, subscriptions webhook, afterAuth
   install sync, redact fixes) are DEPLOYED and merchant-verified. Everything
   is committed and the tree is clean (last commit: production hosting prep —
   render.yaml + healthz + DEPLOY.md).

   TWO things are built + committed but NOT YET DEPLOYED:
   (a) The competitor-parity batch (I approved "DSAR + GPC free, policy
       generator Pro"): Global Privacy Control auto-opt-out in US opt-out
       regions (harness-verified; banner bundle 19233B / 6.93KB gzip vs
       ≤19KB budget — ~220B headroom, so trim before adding storefront code),
       storefront data-request (DSAR) page at /apps/consentinel/privacy +
       /app/requests admin inbox + CUSTOMERS_REDACT erases request rows by
       email, and a Pro cookie policy generator on /app/scanner that writes
       an Online Store page. SCOPES CHANGED "read_themes,write_files" → adds
       write_online_store_pages, so after deploy I must re-open the app once
       and accept the permission prompt.
   (b) Production hosting prep: render.yaml Blueprint, /healthz route,
       DEPLOY.md runbook. The SQLite→Postgres migration regeneration is NOT
       done yet — it needs a Postgres connection string (see step 4).

3. Security review done (SECURITY_REVIEW.md): no High/Critical findings,
   0 npm audit vulns, tenant isolation + auth + injection all verified.

4. **What I (the merchant) am doing THIS SESSION: the production hosting +
   Postgres switch on Render (~$14/mo: $7 web + $7 Postgres).** Claude:
   walk me through DEPLOY.md. My part first (Phase A): I sign up at
   render.com, connect the consentinel GitHub repo, create the Postgres
   database (New → Blueprint picks up render.yaml, OR New → Postgres plan
   Basic-256mb), then paste you its EXTERNAL connection string. THEN you do
   Phase B: switch prisma/schema.prisma provider to "postgresql", delete the
   SQLite prisma/migrations/, regenerate a fresh init migration against my
   database URL, typecheck + build + commit. Use the pasted DB URL ONLY to
   generate migrations — don't write it into any committed file. Then guide
   me through Phase C–E (env vars incl. SHOPIFY_BILLING_TEST, deploy, point
   application_url / redirect_urls / app_proxy.url at the Render URL,
   shopify app deploy, reinstall + verify).

5. After hosting is live, the remaining pre-submission work (in order):
   deploy the parity batch (it deploys together with the production config),
   test it (DSAR form at /apps/consentinel/privacy → appears in /app/requests
   → Mark resolved; Home open-requests card; Pro policy generator writes an
   Online Store page and regeneration updates in place; banner regression),
   fill LISTING.md bracketed fields (support email, privacy-policy URL, app
   icon, demo store), capture the screenshot shot list, EU-VPN spot checks
   (fresh accept → consent-log row + GCM dataLayer), final
   PRE_SUBMISSION_CHECKLIST.md pass, submit. Roadmap after launch
   (COMPETITORS.md): EU Withdrawal form (Directive 2023/2673 — investigate
   durable-medium/email question first), scheduled scans, Meta/TikTok pixel
   integrations, accessibility widget, IAB TCF.

Same working method as before: work incrementally, verify each stage yourself
where you can (typecheck, lint, build, the banner harness with screenshots),
stop for my testing at meaningful checkpoints, ask before major architectural
decisions. If the embedded admin shows "refused to connect", I need to start
the dev server from my terminal (it prompts for the store password, which you
can't enter):
cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com

---
