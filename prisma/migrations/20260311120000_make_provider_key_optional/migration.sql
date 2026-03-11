-- AlterTable: make providerKeyId optional for platform-provided free models
ALTER TABLE "RequestLog" ALTER COLUMN "providerKeyId" DROP NOT NULL;
