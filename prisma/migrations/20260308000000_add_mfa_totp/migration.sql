-- AlterTable
ALTER TABLE "User" ADD COLUMN     "totpSecret" TEXT,
ADD COLUMN     "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "totpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totpLockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "TotpBackupCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "TotpBackupCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TotpBackupCode_userId_idx" ON "TotpBackupCode"("userId");

-- AddForeignKey
ALTER TABLE "TotpBackupCode" ADD CONSTRAINT "TotpBackupCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
