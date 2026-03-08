-- CreateTable
CREATE TABLE "AnomalyEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "AnomalyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnomalyEvent_userId_detectedAt_idx" ON "AnomalyEvent"("userId", "detectedAt");

-- AddForeignKey
ALTER TABLE "AnomalyEvent" ADD CONSTRAINT "AnomalyEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
