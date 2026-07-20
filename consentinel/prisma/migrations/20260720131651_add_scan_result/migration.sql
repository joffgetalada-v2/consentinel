-- CreateTable
CREATE TABLE "ScanResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    "storefrontAccessible" BOOLEAN NOT NULL DEFAULT true,
    "pagesScanned" TEXT NOT NULL DEFAULT '[]',
    "findings" TEXT NOT NULL DEFAULT '[]',
    "error" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "ScanResult_shop_key" ON "ScanResult"("shop");
