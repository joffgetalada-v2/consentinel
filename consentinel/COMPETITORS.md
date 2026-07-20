# Competitor research — 2026-07-20 (session 4)

Snapshot of the Shopify cookie-consent market from App Store listings, for
roadmap planning. Companion to the roadmap in PROJECT_STATUS.md.

## Landscape

| App | Rating | Tiers | Notable |
|---|---|---|---|
| Pandectes GDPR | 5.0 (~2.7k) | Free / $9 / $29 / $49 | Google+Microsoft certified CMP, Built for Shopify |
| Consentmo GDPR | 5.0 (~1.9k) | Free / $9 / $34 / $59 | #1 in category, SOC 2 / ISO 27001, accessibility suite |
| CookieYes | — | Free / $10 / $25 / $55 | Google Gold CMP; pageview-metered pricing |
| Consentik | 4.9 (259) | Free / $6.99 / $11.99 / $20.99 | GCM v2 free (only other one to do this) |
| Complianz | 4.4 (265) | Free / $5.99 | Cheapest; policy generator |

## Feature-frequency across competitors (what the market considers table stakes vs premium)

- **Free tiers commonly include**: banner + preference center, geolocation,
  basic scanner, consent log, EU languages, DSAR/customer data requests
  (Pandectes + Consentmo have DSAR FREE — we don't have it at all yet).
- **$6–10 tier**: Google Consent Mode v2 (we ship FREE — differentiator),
  Meta/TikTok pixel + Microsoft UET consent modes, AI cookie scanner,
  translations, cookie management table.
- **$12–34 tier**: web accessibility widget (ADA/WCAG), EU Withdrawal page
  (Directive 2023/2673), banner timing/page controls, advanced analytics,
  custom CSS, scheduled scans.
- **$21–59 tier**: IAB TCF v2.3 (needs IAB CMP registration), headless/
  Hydrogen, cross-domain consent, Shopify Plus checkout banner, bot
  filtering, scan-behind-password.

## Where Consentinel already wins

- GCM v2, consent stats, script blocking, scanner, region-aware banners,
  CSV-exportable PII-free audit log — mostly free where competitors charge.
- Single $9 Pro vs competitors' 3–4-tier ladders ($29–59 for their full
  suite) — simple pricing is a listing talking point.

## Gaps worth building (recommendation, in order)

1. **GPC (Global Privacy Control) signal support** — Free. Tiny bundle cost;
   auto-honors the browser opt-out signal in opt-out regions. Competitors
   gate it behind paid tiers; regulators (CA/CO) actively enforce it.
2. **Cookie & privacy policy generator** — Pro. We already have scanner
   data; generate a policy page (OS 2.0 page via Admin API) listing found
   services per category. Pandectes charges $9, Complianz $5.99. Zero
   bundle impact. "Scan → generate your cookie policy" is a strong story.
3. **DSAR / customer data request page** — Free (parity: leaders have it
   free). App-proxy form → PII-minimal inbox in admin → merchant resolves.
   Zero banner-bundle impact.
4. **Scheduled scans + "new trackers found" alert** — Pro. Weekly re-scan +
   diff vs last scan, surfaced on Home (needs production hosting first for
   cron).
5. **EU Withdrawal function (Directive 2023/2673)** — Pro. Deadline was
   2026-06-19, merchants are actively scrambling; every competitor sells it
   at $12–34. Shopify only auto-covers Managed Markets stores. Needs a
   design decision: confirmation "on durable medium" (email) without email
   infra — investigate Shopify return-request APIs before committing.
6. **Meta/TikTok/UET pixel consent integrations** — Pro. Via Web Pixel
   extension / per-service map (PHASE2 hook already in the banner).
7. **Deferred**: accessibility widget (separate product, heavy),
   IAB TCF v2.3 (requires IAB CMP registration + audit — enterprise
   feature), headless/Hydrogen, checkout banner (Plus-only market).

## Sources

- https://apps.shopify.com/gdpr-cookie-consent (Pandectes)
- https://apps.shopify.com/gdpr-backpack (Consentmo)
- https://apps.shopify.com/cookieyes
- https://apps.shopify.com/eu-cookies-notification (Consentik)
- https://apps.shopify.com/complianz-gdpr-cookie-consent
- https://help.shopify.com/en/manual/compliance/legal/eu-right-of-withdrawal
- https://www.gtlaw.com/en/insights/2026/5/eu-consumer-law-new-withdrawal-button-requirements-for-online-contracts
