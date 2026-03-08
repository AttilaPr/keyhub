-- AlterTable
ALTER TABLE "PlatformKey" ADD COLUMN     "allowedModels" TEXT[],
ADD COLUMN     "allowedProviders" TEXT[],
ADD COLUMN     "maxCostPerRequest" DOUBLE PRECISION;
