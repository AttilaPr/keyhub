-- Remove unique constraint on (userId, provider) from ProviderKey
-- and replace with a regular index for load balancing support
DROP INDEX IF EXISTS "ProviderKey_userId_provider_key";

-- Add weight and latencyEma columns to ProviderKey
ALTER TABLE "ProviderKey" ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ProviderKey" ADD COLUMN "latencyEma" DOUBLE PRECISION;

-- Add routingStrategy column to PlatformKey
ALTER TABLE "PlatformKey" ADD COLUMN "routingStrategy" TEXT NOT NULL DEFAULT 'round-robin';

-- Create index on (userId, provider) for ProviderKey
CREATE INDEX "ProviderKey_userId_provider_idx" ON "ProviderKey"("userId", "provider");
