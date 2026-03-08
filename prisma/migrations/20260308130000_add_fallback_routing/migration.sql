-- CreateTable
CREATE TABLE "FallbackRule" (
    "id" TEXT NOT NULL,
    "platformKeyId" TEXT NOT NULL,
    "primaryProvider" TEXT NOT NULL,
    "fallbackProvider" TEXT NOT NULL,
    "triggerOnStatus" INTEGER[],
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FallbackRule_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add fallback fields to RequestLog
ALTER TABLE "RequestLog" ADD COLUMN "fallbackUsed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "RequestLog" ADD COLUMN "originalProvider" TEXT;
ALTER TABLE "RequestLog" ADD COLUMN "fallbackProvider" TEXT;

-- CreateIndex
CREATE INDEX "FallbackRule_platformKeyId_idx" ON "FallbackRule"("platformKeyId");

-- AddForeignKey
ALTER TABLE "FallbackRule" ADD CONSTRAINT "FallbackRule_platformKeyId_fkey" FOREIGN KEY ("platformKeyId") REFERENCES "PlatformKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
