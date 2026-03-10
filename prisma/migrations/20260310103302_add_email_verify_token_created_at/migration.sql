-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifyTokenCreatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "AuditEvent_targetType_targetId_idx" ON "AuditEvent"("targetType", "targetId");
