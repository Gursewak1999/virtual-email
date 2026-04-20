-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM (
    'PENDING',
    'COMPLETED',
    'EXPIRED',
    'CANCELLED'
);

-- CreateTable
CREATE TABLE "ConsultationHostProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingSlug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Toronto',
    "defaultDurationMinutes" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationHostProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationAvailabilityWindow" (
    "id" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startMinutes" INTEGER NOT NULL,
    "endMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationAvailabilityWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationBlockedDate" (
    "id" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "dateKey" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationBlockedDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "hostProfileId" TEXT NOT NULL,
    "attendeeName" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "attendeePhone" TEXT,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "meetingCode" TEXT NOT NULL,
    "meetingPath" TEXT NOT NULL,
    "meetingUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationHostProfile_userId_key" ON "ConsultationHostProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationHostProfile_bookingSlug_key" ON "ConsultationHostProfile"("bookingSlug");

-- CreateIndex
CREATE INDEX "ConsultationHostProfile_bookingSlug_idx" ON "ConsultationHostProfile"("bookingSlug");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationAvailabilityWindow_hostProfileId_dayOfWeek_key" ON "ConsultationAvailabilityWindow"("hostProfileId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "ConsultationAvailabilityWindow_hostProfileId_dayOfWeek_idx" ON "ConsultationAvailabilityWindow"("hostProfileId", "dayOfWeek");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationBlockedDate_hostProfileId_dateKey_key" ON "ConsultationBlockedDate"("hostProfileId", "dateKey");

-- CreateIndex
CREATE INDEX "ConsultationBlockedDate_hostProfileId_dateKey_idx" ON "ConsultationBlockedDate"("hostProfileId", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_meetingCode_key" ON "Consultation"("meetingCode");

-- CreateIndex
CREATE INDEX "Consultation_hostId_scheduledAt_idx" ON "Consultation"("hostId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Consultation_hostProfileId_scheduledAt_idx" ON "Consultation"("hostProfileId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Consultation_status_scheduledAt_idx" ON "Consultation"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Consultation_meetingCode_idx" ON "Consultation"("meetingCode");

-- AddForeignKey
ALTER TABLE "ConsultationHostProfile" ADD CONSTRAINT "ConsultationHostProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationAvailabilityWindow" ADD CONSTRAINT "ConsultationAvailabilityWindow_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "ConsultationHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationBlockedDate" ADD CONSTRAINT "ConsultationBlockedDate_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "ConsultationHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_hostProfileId_fkey" FOREIGN KEY ("hostProfileId") REFERENCES "ConsultationHostProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
