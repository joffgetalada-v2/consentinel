-- CreateTable
CREATE TABLE "DataRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "orderInfo" TEXT,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "DataRequest_shop_status_idx" ON "DataRequest"("shop", "status");

-- CreateIndex
CREATE INDEX "DataRequest_shop_email_idx" ON "DataRequest"("shop", "email");
