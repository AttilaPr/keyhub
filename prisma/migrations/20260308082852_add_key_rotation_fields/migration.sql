-- AlterTable
ALTER TABLE "ProviderKey" ADD COLUMN     "lastRotatedAt" TIMESTAMP(3),
ADD COLUMN     "rotationReminderDays" INTEGER;
