/**
 * Unauthenticated health check for the hosting platform (Render/Railway/Fly).
 * Returns 200 with a tiny body so the platform's health probe can tell the
 * service is up. Deliberately does NOT touch the database or Shopify — a
 * health check must stay cheap and must not fail for reasons unrelated to
 * the process being alive.
 */
export const loader = () => {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
};
