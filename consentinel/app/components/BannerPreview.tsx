/**
 * Live preview of the storefront consent banner, rendered inside a mock
 * storefront viewport.
 *
 * Deliberate exception to "no custom-styled admin UI": everything inside the
 * preview frame simulates the *storefront* banner (which is custom-styled by
 * nature), so inline styles are correct here. All admin chrome around it
 * stays Polaris.
 *
 * Keep this component's visual output in sync with the real theme-app-
 * extension banner built in step 5 — it is the merchant's only feedback
 * loop while configuring.
 */
import type { BannerPosition, ThemePreset } from "../types/consent";

export interface BannerPreviewProps {
  heading: string;
  body: string;
  acceptLabel: string;
  rejectLabel: string;
  customizeLabel: string;
  privacyPolicyUrl: string;
  position: BannerPosition;
  themePreset: ThemePreset;
  accentColor: string;
  showBranding: boolean;
}

const PREVIEW_HEIGHT = 340;

export function BannerPreview(props: BannerPreviewProps) {
  const dark = props.themePreset === "dark";
  const surface = dark ? "#1f1f1f" : "#ffffff";
  const text = dark ? "#f5f5f5" : "#1a1a1a";
  const subdued = dark ? "#a3a3a3" : "#616161";
  const border = dark ? "#3d3d3d" : "#e3e3e3";

  const card: React.CSSProperties = {
    background: surface,
    color: text,
    border: `1px solid ${border}`,
    borderRadius: 10,
    boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
    padding: 14,
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 12,
    lineHeight: 1.45,
    position: "absolute",
    ...positionStyles(props.position),
  };

  return (
    <div
      style={{
        position: "relative",
        height: PREVIEW_HEIGHT,
        borderRadius: 8,
        overflow: "hidden",
        // A neutral fake storefront behind the banner.
        background: dark
          ? "linear-gradient(180deg,#2b2b2b 0%,#232323 100%)"
          : "linear-gradient(180deg,#f6f6f7 0%,#ececec 100%)",
      }}
      aria-label="Banner preview"
    >
      <FakeStorefront dark={dark} />
      {props.position === "center_modal" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
          }}
        />
      )}
      <div style={card}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
          {props.heading || "…"}
        </div>
        <div style={{ color: subdued, marginBottom: 10 }}>
          {props.body || "…"}
          {props.privacyPolicyUrl ? (
            <>
              {" "}
              <span style={{ color: props.accentColor, textDecoration: "underline" }}>
                Privacy policy
              </span>
            </>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span
            style={{
              background: props.accentColor,
              color: pickReadableText(props.accentColor),
              borderRadius: 6,
              padding: "6px 12px",
              fontWeight: 600,
            }}
          >
            {props.acceptLabel || "…"}
          </span>
          <span
            style={{
              border: `1px solid ${border}`,
              color: text,
              borderRadius: 6,
              padding: "6px 12px",
              fontWeight: 600,
            }}
          >
            {props.rejectLabel || "…"}
          </span>
          <span style={{ color: subdued, textDecoration: "underline" }}>
            {props.customizeLabel || "…"}
          </span>
        </div>
        {props.showBranding && (
          <div style={{ marginTop: 8, fontSize: 10, color: subdued }}>
            Powered by Consentinel
          </div>
        )}
      </div>
    </div>
  );
}

function positionStyles(position: BannerPosition): React.CSSProperties {
  switch (position) {
    case "bottom_bar":
      return { left: 10, right: 10, bottom: 10 };
    case "bottom_left":
      return { left: 10, bottom: 10, maxWidth: 280 };
    case "bottom_right":
      return { right: 10, bottom: 10, maxWidth: 280 };
    case "center_modal":
      return {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: "min(320px, 85%)",
      };
  }
}

/** WCAG-ish contrast pick: white or near-black text over the accent color. */
function pickReadableText(hex: string): string {
  const match = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex);
  if (!match) return "#ffffff";
  let value = match[1];
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#1a1a1a" : "#ffffff";
}

/** Grey placeholder blocks suggesting a storefront page behind the banner. */
function FakeStorefront({ dark }: { dark: boolean }) {
  const block = dark ? "#3a3a3a" : "#dcdcdc";
  const bar: React.CSSProperties = { background: block, borderRadius: 4 };
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ ...bar, height: 18, width: "40%" }} />
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ ...bar, height: 72, flex: 1 }} />
        <div style={{ ...bar, height: 72, flex: 1 }} />
        <div style={{ ...bar, height: 72, flex: 1 }} />
      </div>
      <div style={{ ...bar, height: 10, width: "80%" }} />
      <div style={{ ...bar, height: 10, width: "65%" }} />
    </div>
  );
}
