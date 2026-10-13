-- Admin/Staff presence per device for the "who is online" indicator. New table only.

-- CreateTable
CREATE TABLE "StaffPresence" (
    "userId" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "soundMuted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPresence_pkey" PRIMARY KEY ("userId","deviceId")
);

-- CreateIndex
CREATE INDEX "StaffPresence_lastSeenAt_idx" ON "StaffPresence"("lastSeenAt");

-- AddForeignKey
ALTER TABLE "StaffPresence" ADD CONSTRAINT "StaffPresence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

