# Copy-paste prompt to resume the Consentinel build

Copy everything between the lines into a fresh Claude Code session opened in
`~/Documents/github/consentinel`.

---

We're continuing "Consentinel", a production-quality cookie-consent/GDPR
compliance Shopify app (React Router template, TypeScript, Prisma, Polaris web
components, theme app extension with pre-consent script blocking + Google
Consent Mode v2, Customer Privacy API only — never raw Shopify cookies).

START HERE:
1. Read consentinel/PROJECT_STATUS.md top to bottom — the "SESSION-2 STOPPING
   POINT" section at the top says exactly where we stopped, and the file has
   all environment quirks for this machine (which shopify CLI binary and
   node@22 PATH prefix, the pseudo-TTY trick for CLI prompts, the local
   banner-test harness recipe).
2. OPEN BUG I REPORTED, fix in progress — my exact feedback from last session:
   "i did some testing now and i notices that some of the setting seems to
   have some big spaces and the checkbox seems not clear."
   Context: with the banner on the dark theme in the bottom-bar position, the
   full-width bar had a huge empty area to the right of the text/buttons, and
   in the Customize (Privacy preferences) view the category rows stretched
   the same width with small unclear checkboxes at the far edge. A fix was
   already written (centered 960px bar with text left / buttons right,
   custom high-contrast checkboxes, whole row clickable) but its VISUAL
   VERIFICATION WAS INTERRUPTED — do not consider it done until it's checked
   in the harness and then confirmed by me on the storefront.
3. In order:
   a. Make a git commit of everything since 82761d6 (all session-2 work is
      uncommitted; commit message ideas are in PROJECT_STATUS).
   b. Finish the interrupted visual verification of the fix above using the
      local banner harness (dark bottom_bar main view + Customize view,
      light + mobile spot checks). Fix anything that looks off.
   c. Tell me when to run `shopify app deploy` (you can't release versions
      yourself) and what to test after — including re-checking the big-spaces
      and checkbox issues on the real storefront.
4. My test results from last time / this round: [PASTE RESULTS OR SCREENSHOTS
   HERE — bottom-bar spacing + checkbox clarity after deploy, consent-log row
   after a fresh accept, GCM dataLayer entries, billing upgrade/cancel flow,
   logo URL on Pro]
5. Remaining backlog after that (details in PROJECT_STATUS "Known follow-ups"):
   metafield sync on first install, APP_SUBSCRIPTIONS_UPDATE webhook,
   pre-submission checklist items (listing assets, production hosting,
   Postgres switch), and the first App Store submission pass.

Same working method as before: work incrementally, verify each stage yourself
where you can (typecheck, lint, build, webhook triggers, the banner harness),
stop for my testing at meaningful checkpoints, ask before major architectural
decisions. If the embedded admin shows "refused to connect", I need to start
the dev server from my terminal (it prompts for the store password, which you
can't enter):
cd ~/Documents/github/consentinel/consentinel && PATH="/usr/local/opt/node@22/bin:$PATH" ~/.npm-global/bin/shopify app dev --store consent-dev.myshopify.com

---
