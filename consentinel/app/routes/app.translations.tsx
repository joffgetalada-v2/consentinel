/**
 * Banner translations (Pro): one card per language, seeded with built-in
 * translations of the default banner copy, merchant-editable. Fixed UI
 * strings (category names, opt-out texts…) translate automatically from
 * the dictionary in app/models/translations.server.ts.
 */
import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { getShopSettings } from "../models/shopSettings.server";
import { syncStorefrontConfig } from "../models/storefrontConfig.server";
import {
  SUPPORTED_LOCALES,
  addTranslation,
  deleteTranslation,
  isSupportedLocale,
  listTranslations,
  updateTranslation,
  type BannerTranslation,
} from "../models/translations.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [settings, translations] = await Promise.all([
    getShopSettings(session.shop),
    listTranslations(session.shop),
  ]);
  return {
    isPaid: settings.plan === "paid",
    translations,
    locales: SUPPORTED_LOCALES,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  if (settings.plan !== "paid") {
    return {
      ok: false as const,
      message: "Banner translations require the Pro plan",
    };
  }

  const form = await request.formData();
  const intent = String(form.get("intent") ?? "");
  const locale = String(form.get("locale") ?? "");
  if (!isSupportedLocale(locale)) {
    return { ok: false as const, message: "Unsupported language" };
  }

  if (intent === "add") {
    await addTranslation(session.shop, locale);
  } else if (intent === "save") {
    const fields = {
      heading: String(form.get("heading") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      acceptLabel: String(form.get("acceptLabel") ?? "").trim(),
      rejectLabel: String(form.get("rejectLabel") ?? "").trim(),
      customizeLabel: String(form.get("customizeLabel") ?? "").trim(),
    };
    if (Object.values(fields).some((value) => value.length === 0)) {
      return { ok: false as const, message: "All fields are required" };
    }
    if (fields.heading.length > 120 || fields.body.length > 1000) {
      return { ok: false as const, message: "Heading or body is too long" };
    }
    await updateTranslation(session.shop, locale, fields);
  } else if (intent === "delete") {
    await deleteTranslation(session.shop, locale);
  } else {
    throw new Response(`Unknown intent "${intent}"`, { status: 400 });
  }

  await syncStorefrontConfig(admin, session.shop);
  return { ok: true as const, message: "Translations updated" };
};

export default function Translations() {
  const { isPaid, translations, locales } = useLoaderData<typeof loader>();
  const addFetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  const available = locales.filter(
    (locale) => !translations.some((row) => row.locale === locale.code),
  );
  const [selected, setSelected] = useState(available[0]?.code ?? "");

  useEffect(() => {
    if (addFetcher.state === "idle" && addFetcher.data && !addFetcher.data.ok) {
      shopify.toast.show(addFetcher.data.message, { isError: true });
    }
  }, [addFetcher.state, addFetcher.data, shopify]);

  const localeLabel = (code: string) =>
    locales.find((locale) => locale.code === code)?.label ?? code;

  return (
    <s-page heading="Banner translations">
      {!isPaid && (
        <s-section>
          <s-banner tone="info" heading="Pro feature">
            <s-paragraph>
              Show the consent banner in your visitors&apos; own language.
              Adding a language instantly translates the whole banner —
              buttons, category descriptions, and the US opt-out texts — and
              you can fine-tune every word. Upgrade on the Plan page to
              unlock it.
            </s-paragraph>
            <s-button href="/app/plan" variant="primary">
              View plans
            </s-button>
          </s-banner>
        </s-section>
      )}

      <s-section heading="Languages">
        <s-paragraph>
          <s-text color="subdued">
            The banner automatically shows in the visitor&apos;s storefront
            language when a translation exists, and falls back to your default
            (English) text otherwise. Built-in translations cover the fixed
            texts; the fields below hold your own banner copy.
          </s-text>
        </s-paragraph>
        {isPaid && available.length > 0 && (
          <s-stack direction="inline" gap="base">
            <s-select
              label="Add a language"
              value={selected}
              onChange={(event: { currentTarget: { value: string } }) =>
                setSelected(event.currentTarget.value)
              }
            >
              {available.map((locale) => (
                <s-option key={locale.code} value={locale.code}>
                  {locale.label}
                </s-option>
              ))}
            </s-select>
            <s-button
              variant="primary"
              onClick={() =>
                addFetcher.submit(
                  { intent: "add", locale: selected || available[0].code },
                  { method: "POST" },
                )
              }
              {...(addFetcher.state !== "idle" ? { loading: true } : {})}
            >
              Add language
            </s-button>
          </s-stack>
        )}
        {translations.length === 0 && (
          <s-paragraph>
            <s-text color="subdued">No languages added yet.</s-text>
          </s-paragraph>
        )}
      </s-section>

      {translations.map((translation) => (
        <TranslationCard
          key={translation.locale}
          translation={translation}
          label={localeLabel(translation.locale)}
        />
      ))}
    </s-page>
  );
}

function TranslationCard({
  translation,
  label,
}: {
  translation: BannerTranslation;
  label: string;
}) {
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();
  const [fields, setFields] = useState({
    heading: translation.heading,
    body: translation.body,
    acceptLabel: translation.acceptLabel,
    rejectLabel: translation.rejectLabel,
    customizeLabel: translation.customizeLabel,
  });

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data) {
      shopify.toast.show(fetcher.data.message, {
        isError: !fetcher.data.ok,
      });
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const set =
    (field: keyof typeof fields) =>
    (event: { currentTarget: { value: string } }) => {
      const value = event.currentTarget.value;
      setFields((previous) => ({ ...previous, [field]: value }));
    };

  const busy = fetcher.state !== "idle";

  return (
    <s-section heading={label}>
      <s-stack direction="block" gap="base">
        <s-text-field label="Heading" value={fields.heading} onInput={set("heading")} />
        <s-text-area label="Body text" value={fields.body} rows={3} onInput={set("body")} />
        <s-stack direction="inline" gap="base">
          <s-text-field
            label="Accept button"
            value={fields.acceptLabel}
            onInput={set("acceptLabel")}
          />
          <s-text-field
            label="Reject button"
            value={fields.rejectLabel}
            onInput={set("rejectLabel")}
          />
          <s-text-field
            label="Customize button"
            value={fields.customizeLabel}
            onInput={set("customizeLabel")}
          />
        </s-stack>
        <s-stack direction="inline" gap="base">
          <s-button
            variant="primary"
            onClick={() =>
              fetcher.submit(
                { intent: "save", locale: translation.locale, ...fields },
                { method: "POST" },
              )
            }
            {...(busy ? { loading: true } : {})}
          >
            Save
          </s-button>
          <s-button
            tone="critical"
            onClick={() =>
              fetcher.submit(
                { intent: "delete", locale: translation.locale },
                { method: "POST" },
              )
            }
            {...(busy ? { disabled: true } : {})}
          >
            Remove language
          </s-button>
        </s-stack>
      </s-stack>
    </s-section>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
