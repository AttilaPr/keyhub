-- CreateEnum
CREATE TYPE "BudgetPeriod" AS ENUM ('daily', 'weekly', 'monthly');

-- AlterTable
ALTER TABLE "PlatformKey" ADD COLUMN     "budgetPeriod" "BudgetPeriod" NOT NULL DEFAULT 'monthly',
ADD COLUMN     "budgetUsd" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "budgetAlertThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
ADD COLUMN     "budgetHardCap" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyBudgetUsd" DOUBLE PRECISION;
