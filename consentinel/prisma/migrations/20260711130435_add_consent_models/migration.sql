-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "heading" TEXT NOT NULL DEFAULT 'We value your privacy',
    "body" TEXT NOT NULL DEFAULT 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. You can accept all cookies, reject non-essential ones, or customize your preferences.',
    "acceptLabel" TEXT NOT NULL DEFAULT 'Accept all',
    "rejectLabel" TEXT NOT NULL DEFAULT 'Reject all',
    "customizeLabel" TEXT NOT NULL DEFAULT 'Customize',
    "privacyPolicyUrl" TEXT,
    "position" TEXT NOT NULL DEFAULT 'bottom_bar',
    "themePreset" TEXT NOT NULL DEFAULT 'light',
    "accentColor" TEXT NOT NULL DEFAULT '#1A1A1A',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "subscriptionId" TEXT,
    "showBranding" BOOLEAN NOT NULL DEFAULT true,
    "onboardingDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RegionRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConsentEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "region" TEXT,
    "mode" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "preferences" BOOLEAN NOT NULL DEFAULT false,
    "analytics" BOOLEAN NOT NULL DEFAULT false,
    "marketing" BOOLEAN NOT NULL DEFAULT false,
    "saleOfDataOptedOut" BOOLEAN,
    "visitorToken" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "RegionRule_shop_idx" ON "RegionRule"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "RegionRule_shop_region_key" ON "RegionRule"("shop", "region");

-- CreateIndex
CREATE INDEX "ConsentEvent_shop_createdAt_idx" ON "ConsentEvent"("shop", "createdAt");
