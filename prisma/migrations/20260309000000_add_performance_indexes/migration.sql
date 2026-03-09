-- Add index on PlatformKey.keyPrefix for fast proxy lookups
CREATE INDEX "PlatformKey_keyPrefix_idx" ON "PlatformKey"("keyPrefix");

-- Add composite index on RequestLog for rate limiting queries
CREATE INDEX "RequestLog_platformKeyId_createdAt_idx" ON "RequestLog"("platformKeyId", "createdAt");

-- Add index for budget queries
CREATE INDEX "RequestLog_platformKeyId_costUsd_idx" ON "RequestLog"("platformKeyId", "costUsd");
