-- AlterTable
ALTER TABLE "RequestLog" ADD COLUMN     "retryCount" INTEGER NOT NULL DEFAULT 0;
