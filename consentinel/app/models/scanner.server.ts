/**
 * Cookie scanner: finds third-party tracking services a store loads, so the
 * merchant sees "we found N trackers" and which ones Consentinel already
 * holds until consent.
 *
 * Two complementary passes, both server-side (the storefront bundle is
 * untouched — it's at its size budget):
 *
 * 1. Rendered storefront fetch (home + one product page). Catches trackers
 *    however they got there. Skipped gracefully when the online store is
 *    password-protected (dev stores always are) — the fetch just sees the
 *    password page.
 * 2. Theme source via the Admin API (read_themes): layout/theme.liquid for
 *    hardcoded pixels and config/settings_data.json for app embeds. Works
 *    even behind storefront passwords.
 *
 * Results are stored latest-per-shop in ScanResult (JSON strings — SQLite).
 */
import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";
import prisma from "../db.server";
import {
  TRACKER_CATALOG,
  matchAppEmbedService,
  type TrackerHandling,
} from "./trackerCatalog.server";

export interface TrackerFinding {
  service: string;
  /** marketing | analytics | preferences | essential | unknown */
  category: string;
  handling: TrackerHandling;
  sources: string[];
}

export interface ScanReport {
  status: "completed" | "failed";
  startedAt: string;
  completedAt: string | null;
  storefrontAccessible: boolean;
  pagesScanned: string[];
  findings: TrackerFinding[];
  error: string | null;
}

const FETCH_TIMEOUT_MS = 8000;
const SCANNER_USER_AGENT = "ConsentinelScanner/1.0 (Shopify app; cookie audit)";

async function fetchText(url: string): Promise<Response | null> {
  try {
    return await fetch(url, {
      headers: { "User-Agent": SCANNER_USER_AGENT, Accept: "text/html,application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch {
    return null; // network error / timeout — treated as "page unavailable"
  }
}

function isPasswordPage(response: Response): boolean {
  return response.status === 401 || new URL(response.url).pathname === "/password";
}

/** Fetches the rendered pages to scan. Returns [] when the storefront is
 * password-protected or unreachable. */
async function fetchStorefrontPages(
  shop: string,
): Promise<{ label: string; text: string }[]> {
  const home = await fetchText(`https://${shop}/`);
  if (!home || !home.ok || isPasswordPage(home)) return [];

  const pages = [{ label: "Home page", text: await home.text() }];

  // One product page: templates often carry trackers the home page doesn't
  // (review widgets, pixels firing on view_item).
  const productsJson = await fetchText(`https://${shop}/products.json?limit=1`);
  if (productsJson?.ok && !isPasswordPage(productsJson)) {
    try {
      const parsed = (await productsJson.json()) as {
        products?: { handle?: string }[];
      };
      const handle = parsed.products?.[0]?.handle;
      if (handle) {
        const product = await fetchText(`https://${shop}/products/${handle}`);
        if (product?.ok && !isPasswordPage(product)) {
          pages.push({ label: "Product page", text: await product.text() });
        }
      }
    } catch {
      // products.json not parseable — home-page scan alone is still useful
    }
  }
  return pages;
}

/** Fetches theme sources worth scanning: theme.liquid (hardcoded pixels) and
 * settings_data.json (app embeds). */
async function fetchThemeSources(
  admin: AdminApiContext,
): Promise<{ label: string; text: string; isSettingsData: boolean }[]> {
  const response = await admin.graphql(
    `#graphql
    query consentinelScannerTheme {
      themes(first: 1, roles: [MAIN]) {
        nodes {
          files(
            filenames: ["layout/theme.liquid", "config/settings_data.json"]
            first: 2
          ) {
            nodes {
              filename
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
  const nodes: { filename?: string; body?: { content?: string } }[] =
    json.data?.themes?.nodes?.[0]?.files?.nodes ?? [];
  return nodes
    .filter((node) => typeof node.body?.content === "string")
    .map((node) => ({
      label:
        node.filename === "config/settings_data.json"
          ? "App embed"
          : `Theme code (${node.filename})`,
      text: node.body?.content ?? "",
      isSettingsData: node.filename === "config/settings_data.json",
    }));
}

/** App embeds enabled in the live theme, from settings_data.json. Our own
 * consent-banner embed is excluded — reporting ourselves would be noise. */
function findAppEmbeds(settingsDataContent: string): string[] {
  try {
    const parsed = JSON.parse(settingsDataContent) as {
      current?: { blocks?: Record<string, { type?: string; disabled?: boolean }> };
    };
    const blocks = parsed.current?.blocks ?? {};
    const embeds: string[] = [];
    for (const block of Object.values(blocks)) {
      if (typeof block?.type !== "string" || block.disabled === true) continue;
      const match = block.type.match(/^shopify:\/\/apps\/([^/]+)\/blocks\/([^/]+)\//);
      if (!match) continue;
      const appName = decodeURIComponent(match[1]).replace(/-/g, " ");
      if (/consent[- ]?banner|consentinel/i.test(block.type)) continue;
      embeds.push(appName);
    }
    return embeds;
  } catch {
    return [];
  }
}

function addFinding(
  byService: Map<string, TrackerFinding>,
  finding: Omit<TrackerFinding, "sources">,
  source: string,
): void {
  const existing = byService.get(finding.service);
  if (existing) {
    if (!existing.sources.includes(source)) existing.sources.push(source);
    return;
  }
  byService.set(finding.service, { ...finding, sources: [source] });
}

export async function runScan(
  admin: AdminApiContext,
  shop: string,
): Promise<ScanReport> {
  const startedAt = new Date();
  const byService = new Map<string, TrackerFinding>();
  const pagesScanned: string[] = [];
  let storefrontAccessible = false;
  let error: string | null = null;

  try {
    const [storefrontPages, themeSources] = await Promise.all([
      fetchStorefrontPages(shop),
      fetchThemeSources(admin).catch(() => {
        // read_themes hiccup: the storefront pass still stands on its own.
        return [] as Awaited<ReturnType<typeof fetchThemeSources>>;
      }),
    ]);
    storefrontAccessible = storefrontPages.length > 0;

    const textSources = [
      ...storefrontPages,
      ...themeSources.filter((source) => !source.isSettingsData),
    ];
    for (const source of textSources) {
      pagesScanned.push(source.label);
      for (const entry of TRACKER_CATALOG) {
        if (entry.pattern.test(source.text)) {
          addFinding(byService, entry, source.label);
        }
      }
    }

    const settingsData = themeSources.find((source) => source.isSettingsData);
    if (settingsData) {
      pagesScanned.push("Theme app embeds");
      for (const embedName of findAppEmbeds(settingsData.text)) {
        const knownService = matchAppEmbedService(embedName);
        addFinding(
          byService,
          {
            service: knownService ? `${knownService} (app embed)` : `${embedName} (app embed)`,
            category: knownService ? "marketing" : "unknown",
            handling: "visible",
          },
          "App embed",
        );
      }
    }

    if (pagesScanned.length === 0) {
      error =
        "Neither the storefront nor the theme could be read. Check that the app has the read_themes permission and try again.";
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Scan failed unexpectedly";
  }

  const report: ScanReport = {
    status: error && pagesScanned.length === 0 ? "failed" : "completed",
    startedAt: startedAt.toISOString(),
    completedAt: new Date().toISOString(),
    storefrontAccessible,
    pagesScanned,
    findings: [...byService.values()].sort((a, b) =>
      a.service.localeCompare(b.service),
    ),
    error,
  };

  await prisma.scanResult.upsert({
    where: { shop },
    update: {
      status: report.status,
      startedAt,
      completedAt: new Date(report.completedAt ?? Date.now()),
      storefrontAccessible,
      pagesScanned: JSON.stringify(report.pagesScanned),
      findings: JSON.stringify(report.findings),
      error,
    },
    create: {
      shop,
      status: report.status,
      startedAt,
      completedAt: new Date(report.completedAt ?? Date.now()),
      storefrontAccessible,
      pagesScanned: JSON.stringify(report.pagesScanned),
      findings: JSON.stringify(report.findings),
      error,
    },
  });

  return report;
}

export async function getLatestScan(shop: string): Promise<ScanReport | null> {
  const row = await prisma.scanResult.findUnique({ where: { shop } });
  if (!row) return null;
  return {
    status: row.status === "failed" ? "failed" : "completed",
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    storefrontAccessible: row.storefrontAccessible,
    pagesScanned: safeParse<string[]>(row.pagesScanned, []),
    findings: safeParse<TrackerFinding[]>(row.findings, []),
    error: row.error,
  };
}

function safeParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
