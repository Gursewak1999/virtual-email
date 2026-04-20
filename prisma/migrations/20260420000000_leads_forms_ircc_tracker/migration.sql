-- CreateEnum
CREATE TYPE "LeadStage" AS ENUM (
    'NEW',
    'CONTACTED',
    'QUALIFIED',
    'DOCS_REQUESTED',
    'SUBMITTED',
    'DECISION_MADE',
    'CLOSED'
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passportId" TEXT,
    "visaProgram" TEXT,
    "countryOfResidence" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
    "score" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntakeFormSubmission" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "ownerId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'dashboard',
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "visaProgram" TEXT,
    "countryOfResidence" TEXT,
    "message" TEXT,
    "consentToContact" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'new',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntakeFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrccCaseProfile" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "leadId" TEXT,
    "label" TEXT NOT NULL,
    "trackerType" TEXT NOT NULL DEFAULT 'manual',
    "irccIdentifier" TEXT,
    "surname" TEXT,
    "dateOfBirth" TEXT,
    "birthCountryCode" TEXT,
    "monitorEnabled" BOOLEAN NOT NULL DEFAULT true,
    "monitorIntervalMinutes" INTEGER NOT NULL DEFAULT 720,
    "lastKnownStatus" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IrccCaseProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IrccCaseSnapshot" (
    "id" TEXT NOT NULL,
    "caseProfileId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "detailLines" TEXT[] NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,

    CONSTRAINT "IrccCaseSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_ownerId_stage_createdAt_idx" ON "Lead"("ownerId", "stage", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "IntakeFormSubmission_ownerId_createdAt_idx" ON "IntakeFormSubmission"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeFormSubmission_email_createdAt_idx" ON "IntakeFormSubmission"("email", "createdAt");

-- CreateIndex
CREATE INDEX "IntakeFormSubmission_status_createdAt_idx" ON "IntakeFormSubmission"("status", "createdAt");

-- CreateIndex
CREATE INDEX "IrccCaseProfile_ownerId_monitorEnabled_nextCheckAt_idx" ON "IrccCaseProfile"("ownerId", "monitorEnabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "IrccCaseProfile_leadId_idx" ON "IrccCaseProfile"("leadId");

-- CreateIndex
CREATE INDEX "IrccCaseSnapshot_caseProfileId_checkedAt_idx" ON "IrccCaseSnapshot"("caseProfileId", "checkedAt");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeFormSubmission" ADD CONSTRAINT "IntakeFormSubmission_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntakeFormSubmission" ADD CONSTRAINT "IntakeFormSubmission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrccCaseProfile" ADD CONSTRAINT "IrccCaseProfile_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrccCaseProfile" ADD CONSTRAINT "IrccCaseProfile_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IrccCaseSnapshot" ADD CONSTRAINT "IrccCaseSnapshot_caseProfileId_fkey" FOREIGN KEY ("caseProfileId") REFERENCES "IrccCaseProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
