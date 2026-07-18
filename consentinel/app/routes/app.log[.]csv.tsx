/**
 * Consent-log CSV export (Pro). Fetched client-side from the log screen —
 * App Bridge attaches the session token to fetch() calls, so this stays an
 * authenticated XHR-style request (a plain document navigation inside the
 * embedded iframe could not carry the token).
 */
import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopSettings } from "../models/shopSettings.server";
import prisma from "../db.server";

const EXPORT_LIMIT = 10000; // newest rows; keeps the response bounded

function csvField(value: string | null): string {
  if (value === null) return "";
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getShopSettings(session.shop);
  if (settings.plan !== "paid") {
    return new Response("Consent-log export requires the Pro plan", {
      status: 403,
    });
  }

  const events = await prisma.consentEvent.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: EXPORT_LIMIT,
  });

  const header =
    "created_at_utc,region,mode,action,preferences,analytics,marketing,sale_of_data_opted_out,visitor_token";
  const rows = events.map((event) =>
    [
      event.createdAt.toISOString(),
      csvField(event.region),
      event.mode,
      event.action,
      String(event.preferences),
      String(event.analytics),
      String(event.marketing),
      event.saleOfDataOptedOut === null ? "" : String(event.saleOfDataOptedOut),
      csvField(event.visitorToken),
    ].join(","),
  );

  return new Response([header, ...rows].join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="consent-log.csv"',
    },
  });
};
