-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN "tag" TEXT;

-- CreateIndex
CREATE INDEX "RequestLog_userId_tag_idx" ON "RequestLog"("userId", "tag");
