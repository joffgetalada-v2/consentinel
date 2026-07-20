import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  BillingInterval,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";
import { syncStorefrontConfig } from "./models/storefrontConfig.server";

// Billing plan definition. The Billing API is the source of truth for a
// shop's subscription; ShopSettings.plan is only a cached copy (see
// app/models/billing.server.ts).
export const PRO_PLAN = "pro";
export const PRO_PLAN_PRICE_USD = 9;
export const PRO_PLAN_TRIAL_DAYS = 14;
// Test mode defaults ON so dev stores and app review can approve charges
// without money moving. Set SHOPIFY_BILLING_TEST=false in production.
export const BILLING_TEST_MODE = process.env.SHOPIFY_BILLING_TEST !== "false";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  billing: {
    [PRO_PLAN]: {
      trialDays: PRO_PLAN_TRIAL_DAYS,
      lineItems: [
        {
          amount: PRO_PLAN_PRICE_USD,
          currencyCode: "USD",
          interval: BillingInterval.Every30Days,
        },
      ],
    },
  },
  hooks: {
    // First install (and re-auth): seed settings + region rules and write the
    // banner_config metafield immediately. Without this, a fresh install that
    // never pressed Save had no metafield, so the storefront embed stayed
    // silent until the merchant's first save.
    afterAuth: async ({ session, admin }) => {
      try {
        await syncStorefrontConfig(admin, session.shop);
      } catch (error) {
        // Never break OAuth over a config sync; the next settings save or
        // plan reconciliation repairs the metafield.
        console.error(`First-install config sync failed for ${session.shop}`, error);
      }
    },
  },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
