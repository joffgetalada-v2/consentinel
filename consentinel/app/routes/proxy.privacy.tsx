/**
 * Public DSAR page at /apps/consentinel/privacy (app proxy).
 *
 * GET renders a privacy-request form as application/liquid, so Shopify wraps
 * it in the store's theme layout — a themed page with zero storefront-bundle
 * cost. POST validates + stores the request and redirects back with a status
 * flag. Nothing the visitor typed is ever echoed into the HTML (no
 * reflection → no XSS surface); status/error states are fixed codes in the
 * query string.
 */
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { createDataRequest } from "../models/dataRequests.server";

const PAGE_PATH = "/apps/consentinel/privacy";

function box(color: string, text: string): string {
  return (
    `<div style="border:1px solid ${color};border-radius:8px;` +
    `padding:12px 16px;margin:0 0 20px">${text}</div>`
  );
}

function pageHtml(status: string | null): string {
  const banner =
    status === "submitted"
      ? box(
          "#9ac79a",
          "<strong>Request received.</strong> The store owner has been " +
            "notified and will respond to the email address you provided.",
        )
      : status === "rate_limited"
        ? box(
            "#e0b4b4",
            "Too many requests right now — please try again in a few minutes.",
          )
        : status === "invalid"
          ? box(
              "#e0b4b4",
              "Please choose a request type and enter a valid email address.",
            )
          : "";

  const form =
    status === "submitted"
      ? `<p><a href="${PAGE_PATH}">Submit another request</a></p>`
      : `
  <form method="post" action="${PAGE_PATH}" style="display:grid;gap:16px;max-width:480px">
    <fieldset style="border:0;padding:0;margin:0;display:grid;gap:8px">
      <legend style="font-weight:600;margin-bottom:8px">What would you like to do?</legend>
      <label><input type="radio" name="type" value="access" checked> Request a copy of my personal data</label>
      <label><input type="radio" name="type" value="deletion"> Delete my personal data</label>
      <label><input type="radio" name="type" value="correction"> Correct my personal data</label>
    </fieldset>
    <label style="display:grid;gap:4px">Email address *
      <input type="email" name="email" required maxlength="254" autocomplete="email" style="padding:8px">
    </label>
    <label style="display:grid;gap:4px">Name
      <input type="text" name="name" maxlength="120" autocomplete="name" style="padding:8px">
    </label>
    <label style="display:grid;gap:4px">Order number (if relevant)
      <input type="text" name="orderInfo" maxlength="60" style="padding:8px">
    </label>
    <label style="display:grid;gap:4px">Anything we should know?
      <textarea name="message" maxlength="2000" rows="4" style="padding:8px"></textarea>
    </label>
    <div style="position:absolute;left:-5000px" aria-hidden="true">
      <input type="text" name="website" tabindex="-1" autocomplete="off">
    </div>
    <button type="submit" style="padding:10px 20px;cursor:pointer">Submit request</button>
  </form>`;

  return `
<div style="max-width:720px;margin:40px auto;padding:0 20px">
  <h1>Privacy requests</h1>
  <p>
    Use this form to exercise your privacy rights with {{ shop.name }} —
    request a copy of the personal data we hold about you, or ask us to
    delete or correct it. We respond to the email address you provide.
  </p>
  ${banner}
  ${form}
</div>`;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { liquid } = await authenticate.public.appProxy(request);
  const status = new URL(request.url).searchParams.get("status");
  return liquid(pageHtml(status));
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  if (!session) return new Response(null, { status: 204 });

  const form = await request.formData();
  // Honeypot filled = bot: acknowledge without storing.
  if (String(form.get("website") ?? "") !== "") {
    return redirectWithStatus("submitted");
  }

  const result = await createDataRequest(session.shop, {
    type: String(form.get("type") ?? ""),
    email: String(form.get("email") ?? ""),
    name: String(form.get("name") ?? ""),
    orderInfo: String(form.get("orderInfo") ?? ""),
    message: String(form.get("message") ?? ""),
  });

  // Duplicates read as success to the visitor — their request IS on file.
  const status =
    result === "created" || result === "duplicate" ? "submitted" : result;
  return redirectWithStatus(status);
};

function redirectWithStatus(status: string): Response {
  return new Response(null, {
    status: 303,
    headers: { Location: `${PAGE_PATH}?status=${status}` },
  });
}
