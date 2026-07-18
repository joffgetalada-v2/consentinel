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
   POINT" section at the top (items -4 through 0, newest first) says exactly
   where we stopped, and the file has all environment quirks for this machine
   (which shopify CLI binary and node@22 PATH prefix, the local banner-test
   harness recipe + its cache-busting/click gotchas).
2. State at end of session 3 (2026-07-19): everything is committed through
   3051d17. A LARGE batch is built + harness-verified but NOT DEPLOYED:
   Advanced styling (Pro: bar/modal/card widths, fonts, borders), logo image
   picker + logo width/position, mobile responsive polish, floating "Privacy
   choices" reopen pill, prefilled preferences, Home 30-day consent stats,
   consent-log CSV export (Pro), app name recased to "Consentinel", banner
   translations in de/fr/es/it/nl/pt (Pro, /app/translations), and real
   embed-status detection on Home. SCOPES CHANGED "" →
   "read_themes,write_files" — after deploy I must re-open the app once and
   accept the permission prompt. Billing works (test mode; distribution was
   set to Public). The banner bundle is 19101B / 6.9KB gzip vs a ≤19KB
   budget — nearly full; trim or bump before adding storefront features.
3. My first steps (remind me): restart the dev server from MY terminal
   (two new migrations since my last restart: show_reopen +
   banner_translations), then deploy from a second terminal:
   cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app deploy --allow-updates
   then re-open the app and accept the permissions prompt.
4. My test results from the deploy: [PASTE RESULTS OR SCREENSHOTS HERE —
   app title now "Consentinel"; Advanced styling widths/fonts/borders on the
   storefront (desktop + phone, ?consentinel_preview=1); logo upload via the
   image picker + logo width/position; "Privacy choices" pill appears after
   a decision and reopens with my choices pre-ticked; Home step 1 flips to
   Done + 30-day stats populate; CSV export downloads on Pro; Translations:
   add French/German, storefront shows translated banner when the store
   language switches; still owed from before (needs VPN to an EU country):
   fresh accept → consent-log row, GCM dataLayer entries]
5. Agreed next build (in order): (a) cookie scanner — the install-driver
   ("we found N trackers"); Phase 2 hooks already marked in
   app/storefront/consent-banner.ts; (b) then the pre-submission pass:
   App Store listing assets, production hosting + Postgres switch,
   metafield sync on first install, APP_SUBSCRIPTIONS_UPDATE webhook.
   Other roadmap ideas researched: DSAR page, auto-generated privacy
   policy, weekly stats email, accessibility widget.

Same working method as before: work incrementally, verify each stage yourself
where you can (typecheck, lint, build, the banner harness with screenshots),
stop for my testing at meaningful checkpoints, ask before major architectural
decisions. If the embedded admin shows "refused to connect", I need to start
the dev server from my terminal (it prompts for the store password, which you
can't enter):
cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com

---
