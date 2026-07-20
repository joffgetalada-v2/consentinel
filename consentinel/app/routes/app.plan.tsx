/**
 * Plan screen: Free vs Pro comparison, upgrade/cancel, and the Pro-only
 * branding toggle.
 *
 * Upgrade uses a NAVIGATION submit (useSubmit), not a fetcher: billing.request
 * responds with a redirect out of the embedded iframe to Shopify's
 * subscription confirmation page, which App Bridge only follows for
 * navigations. After the merchant approves, Shopify sends them back to this
 * page and the loader's syncPlanFromBilling picks up the new subscription.
 */
import { useEffect } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSubmit,
} from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  authenticate,
  BILLING_TEST_MODE,
  PRO_PLAN,
  PRO_PLAN_PRICE_USD,
  PRO_PLAN_TRIAL_DAYS,
} from "../shopify.server";
import {
  canRemoveBranding,
  syncPlanFromBilling,
} from "../models/billing.server";
import {
  getShopSettings,
  updateShowBranding,
} from "../models/shopSettings.server";
import { syncStorefrontConfig } from "../models/storefrontConfig.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const settings = await syncPlanFromBilling(billing, admin, session.shop);
  return {
    plan: settings.plan,
    showBranding: settings.showBranding,
    priceUsd: PRO_PLAN_PRICE_USD,
    trialDays: PRO_PLAN_TRIAL_DAYS,
    testMode: BILLING_TEST_MODE,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");

  if (intent === "upgrade") {
    try {
      // On success this throws the redirect Response to Shopify's
      // subscription confirmation page — it never returns normally.
      // The return URL must be the EMBEDDED admin deep link: Shopify sends
      // the top-level browser there after approval, and a bare app-host URL
      // has no shop/host params, so App Bridge dies on a white page.
      const storeHandle = session.shop.replace(".myshopify.com", "");
      await billing.request({
        plan: PRO_PLAN,
        isTest: BILLING_TEST_MODE,
        returnUrl: `https://admin.shopify.com/store/${storeHandle}/apps/${process.env.SHOPIFY_API_KEY}/app/plan`,
      });
    } catch (error) {
      if (error instanceof Response) throw error; // the confirmation redirect
      // BillingError carries appSubscriptionCreate's userErrors in errorData
      // (e.g. "Apps without a public distribution cannot use the Billing
      // API" until the Partner Dashboard distribution method is chosen).
      const userErrors = (error as { errorData?: { message?: string }[] }).errorData;
      const detail =
        (Array.isArray(userErrors) &&
          userErrors.map((userError) => userError?.message).filter(Boolean).join("; ")) ||
        (error instanceof Error ? error.message : "Unknown billing error");
      console.error("[consentinel] billing request failed:", detail);
      return { ok: false as const, message: `Upgrade failed: ${detail}` };
    }
  }

  if (intent === "cancel") {
    const settings = await getShopSettings(session.shop);
    if (settings.subscriptionId) {
      await billing.cancel({
        subscriptionId: settings.subscriptionId,
        isTest: BILLING_TEST_MODE,
        prorate: true,
      });
    }
    await syncPlanFromBilling(billing, admin, session.shop);
    return { ok: true as const, message: "Subscription cancelled" };
  }

  if (intent === "branding") {
    const settings = await syncPlanFromBilling(billing, admin, session.shop);
    if (!canRemoveBranding(settings.plan)) {
      return {
        ok: false as const,
        message: "Removing the branding credit requires the Pro plan",
      };
    }
    await updateShowBranding(session.shop, form.get("showBranding") === "true");
    await syncStorefrontConfig(admin, session.shop);
    return { ok: true as const, message: "Branding preference saved" };
  }

  throw new Response(`Unknown intent "${intent}"`, { status: 400 });
};

export default function Plan() {
  const data = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const isPaid = data.plan === "paid";
  const isUpgrading = navigation.state !== "idle";
  const isMutating = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      shopify.toast.show(fetcher.data.message, {
        isError: !fetcher.data.ok,
      });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  // The upgrade button submits as a navigation (billing redirects on
  // success), so its failures arrive via actionData rather than the fetcher.
  const actionData = useActionData<typeof action>();
  useEffect(() => {
    if (actionData && !actionData.ok) {
      shopify.toast.show(actionData.message, { isError: true });
    }
  }, [actionData, shopify]);

  return (
    <s-page heading="Plan">
      <s-section heading={isPaid ? "Free" : "Free — your current plan"}>
        <s-stack direction="block" gap="base">
          <s-paragraph>
            Everything a store needs to be compliant, at no cost:
          </s-paragraph>
          <s-paragraph>✓ Consent banner with preferences modal</s-paragraph>
          <s-paragraph>✓ Genuine pre-consent script blocking</s-paragraph>
          <s-paragraph>✓ Google Consent Mode v2</s-paragraph>
          <s-paragraph>✓ Compliant region defaults (EU/UK opt-in, US states opt-out)</s-paragraph>
          <s-paragraph>✓ Consent audit log</s-paragraph>
          <s-paragraph>
            <s-text color="subdued">
              Shows a small &quot;Powered by Consentinel&quot; credit; region rules stay
              on the compliant defaults.
            </s-text>
          </s-paragraph>
        </s-stack>
      </s-section>

      <s-section
        heading={
          isPaid
            ? `Pro — your current plan ($${data.priceUsd}/month)`
            : `Pro — $${data.priceUsd}/month`
        }
      >
        <s-stack direction="block" gap="base">
          <s-paragraph>Everything in Free, plus:</s-paragraph>
          <s-paragraph>✓ Customize region rules (consent model per region, disable regions)</s-paragraph>
          <s-paragraph>✓ Show your company logo on the banner</s-paragraph>
          <s-paragraph>✓ Advanced styling — banner width, fonts, and border thickness</s-paragraph>
          <s-paragraph>✓ Banner translations — German, French, Spanish, Italian, Dutch, Portuguese</s-paragraph>
          <s-paragraph>✓ Consent log CSV export for audits</s-paragraph>
          <s-paragraph>✓ Cookie policy page generator — one click from your scan results</s-paragraph>
          <s-paragraph>✓ Remove the &quot;Powered by&quot; branding credit</s-paragraph>
          {!isPaid && (
            <>
              <s-paragraph>
                <s-text color="subdued">
                  {data.trialDays}-day free trial. Billed through Shopify —
                  cancel anytime, prorated automatically.
                </s-text>
              </s-paragraph>
              <s-button
                variant="primary"
                onClick={() =>
                  submit({ intent: "upgrade" }, { method: "POST" })
                }
                {...(isUpgrading ? { loading: true } : {})}
              >
                Start {data.trialDays}-day free trial
              </s-button>
            </>
          )}
          {isPaid && (
            <>
              <s-switch
                label={'Show "Powered by Consentinel" credit on the banner'}
                checked={data.showBranding}
                onChange={(event: { currentTarget: { checked: boolean } }) =>
                  fetcher.submit(
                    {
                      intent: "branding",
                      showBranding: String(event.currentTarget.checked),
                    },
                    { method: "POST" },
                  )
                }
              />
              <s-button
                tone="critical"
                onClick={() =>
                  fetcher.submit({ intent: "cancel" }, { method: "POST" })
                }
                {...(isMutating ? { loading: true } : {})}
              >
                Cancel subscription
              </s-button>
            </>
          )}
          {data.testMode && (
            <s-paragraph>
              <s-text color="subdued">
                Billing is in test mode — approvals won&apos;t charge a card.
              </s-text>
            </s-paragraph>
          )}
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
