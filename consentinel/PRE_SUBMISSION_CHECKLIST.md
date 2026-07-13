# Pre-submission checklist

Status legend: ✅ done · 🔲 to do before submission · 📝 needs a decision.

## Shopify App Store review requirements

### App setup & security
- ✅ Embedded app using App Bridge + session tokens (template default)
- ✅ Minimal OAuth scopes — none requested (`scopes = ""`)
- ✅ Webhook HMAC verification with 401 on failure (`authenticate.webhook`)
- ✅ App proxy signature verification for storefront consent logging
- 🔲 Production hosting with valid TLS (Render/Railway/Fly — see README)
- 🔲 `application_url` / `redirect_urls` set to the production host
- 🔲 PostgreSQL in production (see README; SQLite is dev-only)

### Mandatory compliance webhooks
- ✅ `customers/data_request` — acknowledged; no customer PII stored
- ✅ `customers/redact` — acknowledged; nothing customer-linked to erase
- ✅ `shop/redact` — purges all shop data (verified with seeded rows)
- ✅ `app/uninstalled` — deletes sessions immediately
- ✅ Configured in `shopify.app.toml` `[webhooks.privacy_compliance]`
- 🔲 Deploy + release the version containing this config

### Billing
- ✅ Billing API (AppSubscription), no external checkout
- ✅ Free plan is genuinely usable (full compliance feature set)
- ✅ Pricing shown in-app before any charge; trial length stated
- ✅ Cancel path inside the app (prorated)
- 🔲 Set `SHOPIFY_BILLING_TEST=false` in production env
- 🔲 App Store listing pricing section must match in-app pricing exactly

### Listing content (all 🔲)
- App name, icon (1200×1200), feature banner
- Screenshots of: home checklist, banner settings + live preview, region
  rules, consent log, plan page, storefront banner (desktop + mobile)
- App introduction (100 chars), details (500 chars), feature list
- Demo store URL or screencast — reviewers must see the banner working
- Privacy policy URL for the app itself
- Support email + response expectations
- Data safety / protected data disclosure: declare what ConsentEvent stores
  (region, mode, action, category booleans, random visitor token — no PII)

### Functional review (reviewer walk-through)
- ✅ Install → onboarding checklist → one-click embed activation deep link
- ✅ Banner renders pre-consent-blocked storefront (pending final merchant
  test — see PROJECT_STATUS.md)
- 🔲 Confirm Shopify's native cookie banner is disabled on the demo store so
  the two banners don't stack (Settings → Customer privacy → Cookie banner)
- 🔲 Test the full billing flow on the dev store (upgrade, approve test
  charge, verify Pro unlocks, cancel, verify downgrade restores branding)

## Built for Shopify (higher bar, post-launch goal)

- ✅ Polaris web components; admin matches Shopify admin look & feel
- ✅ App embed target `compliance_head` (Shopify's slot for consent scripts)
- ✅ No raw Shopify cookies; Customer Privacy API only
- ✅ Storefront bundle ~10.7KB minified, parser-blocking by design and
  documented why; zero storefront API calls (metafield-delivered config)
- ✅ Onboarding checklist with deep links on the home page
- 🔲 Minimum install/review counts — accumulates after launch
- 🔲 Support SLA + documentation site
- 📝 Performance: Lighthouse impact must stay within Shopify's storefront
  thresholds — measure on a real theme once live
- 📝 Consider an `APP_SUBSCRIPTIONS_UPDATE` webhook for instant plan-cache
  sync (currently reconciled on app-open, which meets review but a webhook
  is cleaner)

## Known gaps / decisions on record

- Region logging is coarse (mode only; region often null) — either enrich
  via `Shopify.country` heuristics or document as data-minimization.
- Free-plan gating = "region customization is Pro", not "one region on
  free": all 10 region groups ship enabled so fresh installs are compliant
  everywhere; a plan limit must never force a banner off in a regulated
  region. Revisit only with a deliberate pricing decision.
- Trial length is 14 days (`PRO_PLAN_TRIAL_DAYS` in `app/shopify.server.ts`).
