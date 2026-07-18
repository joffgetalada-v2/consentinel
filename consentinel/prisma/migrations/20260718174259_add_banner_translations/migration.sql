-- CreateTable
CREATE TABLE "BannerTranslation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "acceptLabel" TEXT NOT NULL,
    "rejectLabel" TEXT NOT NULL,
    "customizeLabel" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "BannerTranslation_shop_idx" ON "BannerTranslation"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "BannerTranslation_shop_locale_key" ON "BannerTranslation"("shop", "locale");
