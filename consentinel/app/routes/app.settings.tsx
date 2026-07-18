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
import { canUseAdvancedStyling, canUseLogo } from "../models/billing.server";
import {
  getShopSettings,
  updateShopSettings,
  validateShopSettingsInput,
  type ShopSettingsInput,
} from "../models/shopSettings.server";
import { syncStorefrontConfig } from "../models/storefrontConfig.server";
import { BannerPreview } from "../components/BannerPreview";
import {
  BANNER_FONTS,
  BANNER_POSITIONS,
  BANNER_WIDTHS,
  STYLE_LIMITS,
  THEME_PRESETS,
  type BannerFont,
  type BannerPosition,
  type BannerWidth,
  type ThemePreset,
} from "../types/consent";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  return {
    settings,
    canEditLogo: canUseLogo(settings.plan),
    canEditStyling: canUseAdvancedStyling(settings.plan),
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const form = await request.formData();

  const settings = await getShopSettings(session.shop);
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
    // The logo is a Pro feature: on the free plan the field is ignored
    // entirely (the UI disables it; this guards against crafted requests).
    ...(canUseLogo(settings.plan)
      ? { logoUrl: String(form.get("logoUrl") ?? "") }
      : {}),
    // Advanced styling is likewise Pro-only server-side.
    ...(canUseAdvancedStyling(settings.plan)
      ? {
          bannerWidth: String(form.get("bannerWidth") ?? ""),
          fontFamily: String(form.get("fontFamily") ?? ""),
          fontSize: Number(form.get("fontSize")),
          buttonFontSize: Number(form.get("buttonFontSize")),
          borderWidth: Number(form.get("borderWidth")),
        }
      : {}),
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
  bottom_bar: "Bottom bar",
  bottom_left: "Bottom left card",
  bottom_right: "Bottom right card",
  center_modal: "Centered modal",
};

const THEME_LABELS: Record<ThemePreset, string> = {
  light: "Light",
  dark: "Dark",
};

const WIDTH_LABELS: Record<BannerWidth, string> = {
  contained: "Contained (centered, max 960px)",
  full: "Full width (edge to edge)",
};

const FONT_LABELS: Record<BannerFont, string> = {
  system: "System font (default)",
  theme: "Match my theme's font",
};

/** Size options offered in the selects, derived from the shared clamp limits. */
const sizeOptions = (key: "fontSize" | "buttonFontSize" | "borderWidth"): number[] => {
  const { min, max } = STYLE_LIMITS[key];
  return Array.from({ length: max - min + 1 }, (_, index) => min + index);
};

export default function Settings() {
  const { settings, canEditLogo, canEditStyling } = useLoaderData<typeof loader>();
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
    logoUrl: settings.logoUrl ?? "",
    position: settings.position,
    themePreset: settings.themePreset,
    accentColor: settings.accentColor,
    bannerWidth: settings.bannerWidth,
    fontFamily: settings.fontFamily,
    fontSize: String(settings.fontSize),
    buttonFontSize: String(settings.buttonFontSize),
    borderWidth: String(settings.borderWidth),
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
          <s-text-field
            label="Logo URL"
            value={form.logoUrl}
            onInput={set("logoUrl")}
            error={errorFor("logoUrl")}
            {...(!canEditLogo ? { disabled: true } : {})}
            details={
              canEditLogo
                ? "Shown above the banner heading. Upload the image in Content → Files and paste its URL. Leave empty for no logo."
                : "Pro feature — upgrade on the Plan page to show your company logo on the banner."
            }
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
            details="Used for the accept button and links. Contrast is checked automatically in the preview. On the dark theme pick a light accent so the accept button stands out."
          />
        </s-stack>
      </s-section>

      <s-section heading="Advanced styling">
        <s-stack direction="block" gap="base">
          {!canEditStyling && (
            <s-paragraph>
              <s-text color="subdued">
                Pro feature — upgrade on the Plan page to fine-tune the
                banner&apos;s width, fonts, and borders.
              </s-text>
            </s-paragraph>
          )}
          <s-select
            label="Bottom bar width"
            value={form.bannerWidth}
            onChange={set("bannerWidth")}
            {...(!canEditStyling ? { disabled: true } : {})}
            details="Only applies to the Bottom bar position."
          >
            {BANNER_WIDTHS.map((width) => (
              <s-option key={width} value={width}>
                {WIDTH_LABELS[width]}
              </s-option>
            ))}
          </s-select>
          <s-select
            label="Font"
            value={form.fontFamily}
            onChange={set("fontFamily")}
            {...(!canEditStyling ? { disabled: true } : {})}
            details="Match my theme's font makes the banner use the same typeface as your storefront."
          >
            {BANNER_FONTS.map((fontOption) => (
              <s-option key={fontOption} value={fontOption}>
                {FONT_LABELS[fontOption]}
              </s-option>
            ))}
          </s-select>
          <s-stack direction="inline" gap="base">
            <s-select
              label="Text size"
              value={form.fontSize}
              onChange={set("fontSize")}
              {...(!canEditStyling ? { disabled: true } : {})}
            >
              {sizeOptions("fontSize").map((size) => (
                <s-option key={size} value={String(size)}>
                  {`${size} px`}
                </s-option>
              ))}
            </s-select>
            <s-select
              label="Button text size"
              value={form.buttonFontSize}
              onChange={set("buttonFontSize")}
              {...(!canEditStyling ? { disabled: true } : {})}
            >
              {sizeOptions("buttonFontSize").map((size) => (
                <s-option key={size} value={String(size)}>
                  {`${size} px`}
                </s-option>
              ))}
            </s-select>
            <s-select
              label="Border thickness"
              value={form.borderWidth}
              onChange={set("borderWidth")}
              {...(!canEditStyling ? { disabled: true } : {})}
            >
              {sizeOptions("borderWidth").map((size) => (
                <s-option key={size} value={String(size)}>
                  {size === 0 ? "None" : `${size} px`}
                </s-option>
              ))}
            </s-select>
          </s-stack>
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
          logoUrl={canEditLogo ? form.logoUrl : ""}
          position={(form.position as BannerPosition) ?? "bottom_bar"}
          themePreset={(form.themePreset as ThemePreset) ?? "light"}
          accentColor={form.accentColor}
          showBranding={settings.showBranding}
          bannerWidth={
            canEditStyling ? ((form.bannerWidth as BannerWidth) ?? "contained") : "contained"
          }
          fontSize={canEditStyling ? Number(form.fontSize) || 14 : 14}
          buttonFontSize={canEditStyling ? Number(form.buttonFontSize) || 14 : 14}
          borderWidth={canEditStyling ? Number(form.borderWidth) || 0 : 1}
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
