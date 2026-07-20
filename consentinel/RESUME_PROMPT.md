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
   cache-busting/click gotchas).
2. State at end of session 4 (2026-07-20): the session-3 batch AND the
   launch-prep batch (cookie scanner, subscriptions webhook, afterAuth
   install sync, redact fixes) are deployed and I verified both with no
   issues. A NEW competitor-parity batch is committed but NOT DEPLOYED
   (research in COMPETITORS.md; I approved "DSAR + GPC free, policy
   generator Pro"): Global Privacy Control auto-opt-out in US opt-out
   regions (harness-verified; bundle 19233B / 6.93KB gzip vs ≤19KB budget
   — ~220B headroom), storefront data-request (DSAR) page at
   /apps/consentinel/privacy + /app/requests admin inbox +
   CUSTOMERS_REDACT now erases request rows by email, and a Pro cookie
   policy generator on /app/scanner that writes an Online Store page.
   SCOPES CHANGED "read_themes,write_files" → adds
   write_online_store_pages — after deploy I must re-open the app once
   and accept the permission prompt. LISTING.md still has bracketed
   fields to fill (support email, privacy-policy URL, app icon, demo
   store decision).
3. My first steps (remind me): restart the dev server from MY terminal
   (two new migrations since my last restart: add_data_requests +
   add_policy_page), then deploy from a second terminal:
   cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app deploy --allow-updates
   then re-open the app and accept the permissions prompt (new scope).
4. My test results from the deploy: [PASTE RESULTS OR SCREENSHOTS HERE —
   storefront /apps/consentinel/privacy renders themed, submitting a
   request shows the confirmation and the request appears in
   /app/requests where Mark resolved works; Home shows the open-requests
   card; on Pro, "Generate cookie policy page" creates Online Store →
   Pages → Cookie Policy and regenerating updates it in place; banner
   still renders normally on the storefront (GPC regression was
   harness-verified); still owed from before (needs EU VPN): fresh
   accept → consent-log row, GCM dataLayer entries]
5. Agreed next work (in order): (a) production hosting + Postgres switch —
   I need to pick Render / Railway / Fly (README documents all three), then
   we do the switch + env vars + SHOPIFY_BILLING_TEST=false plan;
   (b) finish LISTING.md fields + capture the screenshot shot list;
   (c) final pass over PRE_SUBMISSION_CHECKLIST.md and submit.
   Roadmap after launch (COMPETITORS.md): EU Withdrawal form (Directive
   2023/2673 — investigate durable-medium/email question first),
   scheduled scans, Meta/TikTok pixel integrations, accessibility widget,
   IAB TCF.

Same working method as before: work incrementally, verify each stage yourself
where you can (typecheck, lint, build, the banner harness with screenshots),
stop for my testing at meaningful checkpoints, ask before major architectural
decisions. If the embedded admin shows "refused to connect", I need to start
the dev server from my terminal (it prompts for the store password, which you
can't enter):
cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com

---
