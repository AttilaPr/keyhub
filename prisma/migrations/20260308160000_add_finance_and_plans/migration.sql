-- AlterTable: Add pricingMultiplier and planId to User
ALTER TABLE "User" ADD COLUMN "pricingMultiplier" DOUBLE PRECISION NOT NULL DEFAULT 1.0;
ALTER TABLE "User" ADD COLUMN "planId" TEXT;

-- AlterTable: Add planId to Organization
ALTER TABLE "Organization" ADD COLUMN "planId" TEXT;

-- CreateTable: CreditTransaction
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Plan
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "monthlyPriceUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "requestsPerMonth" INTEGER NOT NULL DEFAULT 0,
    "platformKeysLimit" INTEGER NOT NULL DEFAULT 5,
    "providerKeysLimit" INTEGER NOT NULL DEFAULT 4,
    "teamMembersLimit" INTEGER NOT NULL DEFAULT 1,
    "logsRetentionDays" INTEGER NOT NULL DEFAULT 30,
    "apiRateLimit" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_createdAt_idx" ON "CreditTransaction"("userId", "createdAt");
CREATE INDEX "CreditTransaction_adminId_idx" ON "CreditTransaction"("adminId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_name_key" ON "Plan"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditTransaction" ADD CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
