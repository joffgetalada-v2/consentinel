import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

/**
 * GDPR mandatory webhook: sent 48 hours after a shop uninstalls the app.
 * This is the point where we must erase everything we hold for the shop.
 * APP_UNINSTALLED only clears sessions (tokens are dead immediately);
 * settings, region rules, and the consent audit log are kept for the
 * 48-hour window so a quick reinstall restores the merchant's setup,
 * then purged here.
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  const [events, rules, settings, sessions] = await db.$transaction([
    db.consentEvent.deleteMany({ where: { shop } }),
    db.regionRule.deleteMany({ where: { shop } }),
    db.shopSettings.deleteMany({ where: { shop } }),
    db.session.deleteMany({ where: { shop } }),
  ]);
  console.log(
    `Received ${topic} webhook for ${shop}: purged ${events.count} consent events, ${rules.count} region rules, ${settings.count} settings rows, ${sessions.count} sessions`,
  );

  return new Response();
};
