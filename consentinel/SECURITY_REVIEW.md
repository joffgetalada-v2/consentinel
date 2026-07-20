# Security review — 2026-07-20 (session 4)

Code-level security audit of the Consentinel app ahead of App Store
submission. Scope: the app's own attack surface (public endpoints, auth,
tenant isolation, injection, secrets, dependencies). This is a static review
of the source, not a live network penetration test — a live test against the
dev tunnel would be blocked by the storefront password and would target
Shopify infrastructure, which their terms prohibit.

## Result: no High or Critical issues found.

The app follows Shopify's security model correctly. Findings below are one
Low hardening item and confirmations of things that are already right.

## What was checked and is correct

| Area | Finding |
|---|---|
| **Authentication** | Every admin route calls `authenticate.admin`; every webhook calls `authenticate.webhook` (HMAC-verified, 401 on bad signature); both app-proxy endpoints call `authenticate.public.appProxy` (Shopify signature verified). No unauthenticated handler exists. |
| **Tenant isolation** | Every DB access derives `shop` from the authenticated `session.shop`, never from client input. Status/redact mutations use `updateMany`/`deleteMany` with `{ id, shop }` guards, so a forged id from another shop matches zero rows. One merchant cannot read or modify another's data. |
| **SQL injection** | None possible: all data access is through Prisma's parameterized query builder. No `$queryRaw`/`$executeRaw` anywhere. |
| **Storefront XSS (banner)** | Merchant content is escaped with `escapeHtml`/`escapeAttribute` before every `innerHTML` write; button labels use `textContent`. `privacyPolicyUrl`/`logoUrl` are additionally scheme-validated on write (`isPolicyUrl` allows only http(s) or store-relative paths), so a `javascript:` URL is rejected at the boundary — escaping is defense-in-depth on top of that. |
| **DSAR page XSS** | The Liquid page never reflects visitor input; only fixed status codes (`submitted`/`invalid`/`rate_limited`) are compared, never interpolated. `{{ shop.name }}` is Shopify-rendered (the store's own name) — this is why the dev store shows "consent-dev"; a real merchant sees their store name. |
| **Public input validation** | Consent events: enums checked, free-text length-capped, unknowns dropped. DSAR: type enum + email regex + length caps + honeypot + per-shop rate limit. |
| **SSRF** | The scanner only fetches `https://{session.shop}/…` (validated myshopify domain) and a product handle from the shop's own `products.json`. No user-controlled URL reaches `fetch`. |
| **Secrets** | No secrets committed; `.env*` gitignored (`.env.example` is the only tracked env file). API secret read from `process.env`. |
| **Error leakage** | No route returns a raw exception message to the client. Billing surfaces a sanitized message; server-side detail goes to `console.error` only. |
| **PII minimization** | The consent log is PII-free by design. The one PII table (DataRequest) is purged by SHOP_REDACT and by CUSTOMERS_REDACT (by email) — both verified in code. |
| **Dependencies** | `npm audit --omit=dev`: 0 vulnerabilities. |
| **Billing integrity** | Plan is always re-verified against the Billing API (source of truth); the cached flag can only ever under-grant, never over-grant, Pro features. |

## Low — hardening suggestions (optional, not blockers)

1. **DSAR rate-limit is a per-shop global counter** (20 creations / 10 min).
   This protects the merchant's inbox, but a determined abuser could submit
   20 junk requests and briefly make legitimate visitors see "try again
   later." Acceptable for launch; if it becomes a problem, switch to a
   per-email or per-IP window (IP needs care under GDPR — hash, don't store).

2. **No app-level security response headers** (CSP, HSTS, X-Content-Type-
   Options). The embedded admin runs inside Shopify's iframe and inherits
   Shopify's frame protections, and the DSAR page inherits the theme's
   headers, so this is low priority — but adding a strict CSP on the app's
   own responses in the production host config is good practice.

3. **Scanner fetch has an 8s timeout but no response-size cap.** A malicious
   or broken storefront could return a very large body. Low risk (it's the
   merchant's own store), but a byte cap on `.text()` would bound memory.

## Not applicable / out of scope

- CAPTCHA on the DSAR form — deliberately avoided (honeypot + rate limit
  chosen instead; CAPTCHAs harm the privacy-request UX and accessibility).
- CSRF tokens — app-proxy POSTs are Shopify-signature-verified; admin
  mutations go through App Bridge session tokens.
