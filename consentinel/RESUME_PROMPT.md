# Copy-paste prompt to resume the Consentinel build

Copy everything between the lines into a fresh Claude Code session opened in
`~/Documents/github/consentinel`.

---

We're continuing "Consentinel", a production-quality cookie-consent/GDPR
compliance Shopify app (React Router template, TypeScript, Prisma, Polaris web
components, theme app extension with pre-consent script blocking + Google
Consent Mode v2, Customer Privacy API only — never raw Shopify cookies).

START HERE:
1. Read consentinel/PROJECT_STATUS.md top to bottom — the "SESSION-3 STOPPING
   POINT" section at the top says exactly where we stopped, and the file has
   all environment quirks for this machine (which shopify CLI binary and
   node@22 PATH prefix, the pseudo-TTY trick for CLI prompts, the local
   banner-test harness recipe + its cache-busting/click gotchas).
2. State at end of session 3 (2026-07-18): everything is committed (648414e).
   The bottom-bar big-spaces + unclear-checkbox fix I reported IS harness-
   verified, plus four extra theme-bleed leak fixes, a mobile action-row fix,
   and a double-click submit guard. NOT YET DEPLOYED — I run
   `PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app deploy --allow-updates`
   from consentinel/ myself.
3. My test results from the deploy: [PASTE RESULTS OR SCREENSHOTS HERE —
   bottom-bar spacing + checkbox clarity on the real storefront (desktop +
   phone), Customize view, consent-log row after a fresh accept, GCM
   dataLayer entries, billing upgrade/cancel flow, logo URL on Pro]
4. Work through whatever my results turn up; then the backlog (details in
   PROJECT_STATUS "Known follow-ups"): metafield sync on first install,
   APP_SUBSCRIPTIONS_UPDATE webhook, pre-submission checklist items (listing
   assets, production hosting, Postgres switch), and the first App Store
   submission pass. NOTE: the banner bundle is at ~0 bytes of headroom under
   its 16KiB budget — any new banner feature must trim something first.

Same working method as before: work incrementally, verify each stage yourself
where you can (typecheck, lint, build, webhook triggers, the banner harness),
stop for my testing at meaningful checkpoints, ask before major architectural
decisions. If the embedded admin shows "refused to connect", I need to start
the dev server from my terminal (it prompts for the store password, which you
can't enter):
cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com

---
