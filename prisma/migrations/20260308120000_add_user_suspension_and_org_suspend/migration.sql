-- AlterTable
ALTER TABLE "User" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendReason" TEXT,
ADD COLUMN     "sessionInvalidatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false;
