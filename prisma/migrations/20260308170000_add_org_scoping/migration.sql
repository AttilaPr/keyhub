-- AlterTable: Add orgId to ProviderKey
ALTER TABLE "ProviderKey" ADD COLUMN "orgId" TEXT;

-- AlterTable: Add orgId to PlatformKey
ALTER TABLE "PlatformKey" ADD COLUMN "orgId" TEXT;

-- AlterTable: Add orgId to RequestLog
ALTER TABLE "RequestLog" ADD COLUMN "orgId" TEXT;

-- CreateIndex
CREATE INDEX "ProviderKey_orgId_idx" ON "ProviderKey"("orgId");

-- CreateIndex
CREATE INDEX "PlatformKey_orgId_idx" ON "PlatformKey"("orgId");

-- CreateIndex
CREATE INDEX "RequestLog_orgId_idx" ON "RequestLog"("orgId");

-- AddForeignKey
ALTER TABLE "ProviderKey" ADD CONSTRAINT "ProviderKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformKey" ADD CONSTRAINT "PlatformKey_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestLog" ADD CONSTRAINT "RequestLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
