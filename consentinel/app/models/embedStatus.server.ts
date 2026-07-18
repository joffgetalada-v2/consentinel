/**
 * Detects whether the consent-banner app embed is enabled in the published
 * theme, so the Home checklist reflects reality instead of a permanent
 * "To do". Reads config/settings_data.json from the MAIN theme (read_themes
 * scope); app-embed blocks appear under current.blocks with a type like
 * "shopify://apps/<app>/blocks/consent-banner/<uuid>" and disabled:true
 * when toggled off in the theme editor.
 */
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

export async function isEmbedActive(
  admin: AdminApiContext,
): Promise<boolean | null> {
  try {
    const response = await admin.graphql(
      `#graphql
      query consentinelEmbedStatus {
        themes(first: 1, roles: [MAIN]) {
          nodes {
            files(filenames: ["config/settings_data.json"], first: 1) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText { content }
                }
              }
            }
          }
        }
      }`,
    );
    const json = await response.json();
    const content: string | undefined =
      json.data?.themes?.nodes?.[0]?.files?.nodes?.[0]?.body?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      current?: { blocks?: Record<string, { type?: string; disabled?: boolean }> };
    };
    const blocks = parsed.current?.blocks ?? {};
    for (const block of Object.values(blocks)) {
      if (
        typeof block?.type === "string" &&
        block.type.includes("/consent-banner/")
      ) {
        return block.disabled !== true;
      }
    }
    return false; // theme parsed fine and our embed simply isn't there
  } catch {
    // Scope not granted yet / API hiccup: report "unknown", never crash Home.
    return null;
  }
}
