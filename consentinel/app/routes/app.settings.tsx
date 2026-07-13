/**
 * Banner configuration screen: content, appearance, and a live preview that
 * updates as the merchant types. Validation errors from the action render
 * inline on the offending field.
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
import {
  getShopSettings,
  updateShopSettings,
  validateShopSettingsInput,
  type ShopSettingsInput,
} from "../models/shopSettings.server";
import { syncStorefrontConfig } from "../models/storefrontConfig.server";
import { BannerPreview } from "../components/BannerPreview";
import {
  BANNER_POSITIONS,
  THEME_PRESETS,
  type BannerPosition,
  type ThemePreset,
} from "../types/consent";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return { settings };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();

  const input: ShopSettingsInput = {
    heading: String(form.get("heading") ?? ""),
    body: String(form.get("body") ?? ""),
    acceptLabel: String(form.get("acceptLabel") ?? ""),
    rejectLabel: String(form.get("rejectLabel") ?? ""),
    customizeLabel: String(form.get("customizeLabel") ?? ""),
    privacyPolicyUrl: String(form.get("privacyPolicyUrl") ?? ""),
    position: String(form.get("position") ?? ""),
    themePreset: String(form.get("themePreset") ?? ""),
    accentColor: String(form.get("accentColor") ?? ""),
  };

  const errors = validateShopSettingsInput(input);
  if (errors.length > 0) {
    return { ok: false as const, errors };
  }

  await updateShopSettings(session.shop, input);
  // Push the new config to the storefront (app-owned metafield) so the
  // banner reflects changes without any storefront-side API calls.
  await syncStorefrontConfig(admin, session.shop);
  return { ok: true as const, errors: [] };
};

const POSITION_LABELS: Record<BannerPosition, string> = {
  bottom_bar: "Bottom bar (full width)",
  bottom_left: "Bottom left card",
  bottom_right: "Bottom right card",
  center_modal: "Centered modal",
};

const THEME_LABELS: Record<ThemePreset, string> = {
  light: "Light",
  dark: "Dark",
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<typeof action>();
  const shopify = useAppBridge();

  // Controlled form state so the preview tracks every keystroke.
  const [form, setForm] = useState({
    heading: settings.heading,
    body: settings.body,
    acceptLabel: settings.acceptLabel,
    rejectLabel: settings.rejectLabel,
    customizeLabel: settings.customizeLabel,
    privacyPolicyUrl: settings.privacyPolicyUrl ?? "",
    position: settings.position,
    themePreset: settings.themePreset,
    accentColor: settings.accentColor,
  });

  const isSaving = fetcher.state !== "idle";

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.ok) {
      shopify.toast.show("Banner settings saved");
    }
  }, [fetcher.state, fetcher.data, shopify]);

  const errorFor = (field: string): string | undefined =>
    fetcher.data?.errors?.find((error) => error.field === field)?.message;

  // Read currentTarget.value synchronously: it is nulled once event dispatch
  // finishes, and React may run state updaters after that (crashes otherwise).
  const set = (field: keyof typeof form) => (event: { currentTarget: { value: string } }) => {
    const value = event.currentTarget.value;
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const save = () => fetcher.submit(form, { method: "POST" });

  return (
    <s-page heading="Banner settings">
      <s-button
        slot="primary-action"
        onClick={save}
        {...(isSaving ? { loading: true } : {})}
      >
        Save
      </s-button>

      <s-section heading="Content">
        <s-stack direction="block" gap="base">
          <s-text-field
            label="Heading"
            value={form.heading}
            onInput={set("heading")}
            error={errorFor("heading")}
          />
          <s-text-area
            label="Body text"
            value={form.body}
            rows={4}
            onInput={set("body")}
            error={errorFor("body")}
          />
          <s-stack direction="inline" gap="base">
            <s-text-field
              label="Accept button"
              value={form.acceptLabel}
              onInput={set("acceptLabel")}
              error={errorFor("acceptLabel")}
            />
            <s-text-field
              label="Reject button"
              value={form.rejectLabel}
              onInput={set("rejectLabel")}
              error={errorFor("rejectLabel")}
            />
            <s-text-field
              label="Customize button"
              value={form.customizeLabel}
              onInput={set("customizeLabel")}
              error={errorFor("customizeLabel")}
            />
          </s-stack>
          <s-text-field
            label="Privacy policy URL"
            value={form.privacyPolicyUrl}
            onInput={set("privacyPolicyUrl")}
            error={errorFor("privacyPolicyUrl")}
            details="Full URL or store path like /policies/privacy-policy. Leave empty to hide the link."
          />
        </s-stack>
      </s-section>

      <s-section heading="Appearance">
        <s-stack direction="block" gap="base">
          <s-select
            label="Position"
            value={form.position}
            onChange={set("position")}
          >
            {BANNER_POSITIONS.map((position) => (
              <s-option key={position} value={position}>
                {POSITION_LABELS[position]}
              </s-option>
            ))}
          </s-select>
          <s-select
            label="Theme"
            value={form.themePreset}
            onChange={set("themePreset")}
          >
            {THEME_PRESETS.map((preset) => (
              <s-option key={preset} value={preset}>
                {THEME_LABELS[preset]}
              </s-option>
            ))}
          </s-select>
          <s-color-field
            label="Accent color"
            value={form.accentColor}
            onInput={set("accentColor")}
            error={errorFor("accentColor")}
            details="Used for the accept button and links. Contrast is checked automatically in the preview."
          />
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="Live preview">
        <BannerPreview
          heading={form.heading}
          body={form.body}
          acceptLabel={form.acceptLabel}
          rejectLabel={form.rejectLabel}
          customizeLabel={form.customizeLabel}
          privacyPolicyUrl={form.privacyPolicyUrl}
          position={(form.position as BannerPosition) ?? "bottom_bar"}
          themePreset={(form.themePreset as ThemePreset) ?? "light"}
          accentColor={form.accentColor}
          showBranding={settings.showBranding}
        />
        <s-paragraph>
          <s-text color="subdued">
            The preview approximates your storefront banner. The real banner is
            rendered by the app embed once it&apos;s activated in your theme.
          </s-text>
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
