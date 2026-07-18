-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "heading" TEXT NOT NULL DEFAULT 'We value your privacy',
    "body" TEXT NOT NULL DEFAULT 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. You can accept all cookies, reject non-essential ones, or customize your preferences.',
    "acceptLabel" TEXT NOT NULL DEFAULT 'Accept all',
    "rejectLabel" TEXT NOT NULL DEFAULT 'Reject all',
    "customizeLabel" TEXT NOT NULL DEFAULT 'Customize',
    "privacyPolicyUrl" TEXT,
    "logoUrl" TEXT,
    "logoSize" INTEGER NOT NULL DEFAULT 120,
    "logoPosition" TEXT NOT NULL DEFAULT 'top',
    "position" TEXT NOT NULL DEFAULT 'bottom_bar',
    "themePreset" TEXT NOT NULL DEFAULT 'light',
    "accentColor" TEXT NOT NULL DEFAULT '#1A1A1A',
    "bannerWidth" TEXT NOT NULL DEFAULT 'contained',
    "fontFamily" TEXT NOT NULL DEFAULT 'system',
    "fontSize" INTEGER NOT NULL DEFAULT 14,
    "buttonFontSize" INTEGER NOT NULL DEFAULT 14,
    "borderWidth" INTEGER NOT NULL DEFAULT 1,
    "modalWidth" INTEGER NOT NULL DEFAULT 460,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionId" TEXT,
    "showBranding" BOOLEAN NOT NULL DEFAULT true,
    "onboardingDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_ShopSettings" ("accentColor", "acceptLabel", "bannerWidth", "body", "borderWidth", "buttonFontSize", "createdAt", "customizeLabel", "fontFamily", "fontSize", "heading", "id", "logoPosition", "logoSize", "logoUrl", "onboardingDismissed", "plan", "position", "privacyPolicyUrl", "rejectLabel", "shop", "showBranding", "subscriptionId", "themePreset", "updatedAt") SELECT "accentColor", "acceptLabel", "bannerWidth", "body", "borderWidth", "buttonFontSize", "createdAt", "customizeLabel", "fontFamily", "fontSize", "heading", "id", "logoPosition", "logoSize", "logoUrl", "onboardingDismissed", "plan", "position", "privacyPolicyUrl", "rejectLabel", "shop", "showBranding", "subscriptionId", "themePreset", "updatedAt" FROM "ShopSettings";
DROP TABLE "ShopSettings";
ALTER TABLE "new_ShopSettings" RENAME TO "ShopSettings";
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Existing rows saved logoSize as a HEIGHT (24/36/48); reinterpret as the
-- new width semantics by resetting to the new default.
UPDATE "ShopSettings" SET "logoSize" = 120;
