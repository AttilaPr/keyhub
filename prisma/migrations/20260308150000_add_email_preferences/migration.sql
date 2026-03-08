-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailBudgetAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailAnomalyAlerts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailKeyRotation" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "emailKeyExpiry" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "anomalyDetectionEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "anomalyThresholdSigma" DOUBLE PRECISION NOT NULL DEFAULT 3.0,
ADD COLUMN     "anomalyNotifyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "anomalyNotifyWebhook" BOOLEAN NOT NULL DEFAULT true;
