-- CreateEnum
CREATE TYPE "ConsultationMeetingRole" AS ENUM (
    'HOST',
    'GUEST'
);

-- CreateTable
CREATE TABLE "ConsultationMeetingEvent" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "senderRole" "ConsultationMeetingRole" NOT NULL,
    "senderClientId" TEXT NOT NULL,
    "targetRole" "ConsultationMeetingRole",
    "targetClientId" TEXT,
    "eventType" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationMeetingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationMeetingEvent_consultationId_createdAt_idx" ON "ConsultationMeetingEvent"("consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationMeetingEvent_consultationId_senderRole_createdAt_idx" ON "ConsultationMeetingEvent"("consultationId", "senderRole", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationMeetingEvent_consultationId_targetRole_createdAt_idx" ON "ConsultationMeetingEvent"("consultationId", "targetRole", "createdAt");

-- CreateIndex
CREATE INDEX "ConsultationMeetingEvent_consultationId_targetClientId_createdAt_idx" ON "ConsultationMeetingEvent"("consultationId", "targetClientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConsultationMeetingEvent" ADD CONSTRAINT "ConsultationMeetingEvent_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
