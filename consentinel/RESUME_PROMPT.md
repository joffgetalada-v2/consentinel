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
2. State at end of session 4 (2026-07-20): the whole session-3 batch is
   deployed and I verified it with no issues. A NEW launch-prep batch is
   committed through 84b8824 but NOT DEPLOYED: cookie scanner (server-side;
   /app/scanner + Home teaser; new ScanResult model + add_scan_result
   migration), APP_SUBSCRIPTIONS_UPDATE webhook (toml changed → deploy
   required), first-install metafield sync via afterAuth (fresh installs get
   a banner immediately), SHOP_REDACT purge fix (BannerTranslation +
   ScanResult now purged). LISTING.md holds the App Store listing draft with
   bracketed fields I still need to fill (support email, privacy-policy URL,
   app icon, demo store decision). Banner bundle untouched: 19101B / 6.9KB
   gzip vs ≤19KB budget — nearly full; trim or bump before storefront
   features.
3. My first steps (remind me): restart the dev server from MY terminal
   (one new migration since my last restart: add_scan_result), then deploy
   from a second terminal:
   cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app deploy --allow-updates
   (no new scopes this time — no permission prompt expected).
4. My test results from the deploy: [PASTE RESULTS OR SCREENSHOTS HERE —
   /app/scanner "Scan my store" on the dev store (EXPECTED: notice that the
   storefront is password-protected; findings come from theme code + app
   embeds only); Home shows the Cookie scanner card with the count; plan
   upgrade or cancel flips the plan WITHOUT reopening the app (new webhook);
   still owed from before (needs VPN to an EU country): fresh accept →
   consent-log row, GCM dataLayer entries]
5. Agreed next work (in order): (a) production hosting + Postgres switch —
   I need to pick Render / Railway / Fly (README documents all three), then
   we do the switch + env vars + SHOPIFY_BILLING_TEST=false plan;
   (b) finish LISTING.md fields + capture the screenshot shot list;
   (c) final pass over PRE_SUBMISSION_CHECKLIST.md and submit.
   Roadmap after launch: DSAR page, auto-generated privacy policy, weekly
   stats email, accessibility widget, Meta/TikTok pixel integrations,
   IAB TCF.

Same working method as before: work incrementally, verify each stage yourself
where you can (typecheck, lint, build, the banner harness with screenshots),
stop for my testing at meaningful checkpoints, ask before major architectural
decisions. If the embedded admin shows "refused to connect", I need to start
the dev server from my terminal (it prompts for the store password, which you
can't enter):
cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com

---
