-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "resendEmailId" TEXT NOT NULL,
    "webhookEventType" TEXT NOT NULL,
    "webhookCreatedAt" TIMESTAMP(3),
    "webhookReceivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resendCreatedAt" TIMESTAMP(3),
    "fromRaw" TEXT NOT NULL,
    "fromName" TEXT,
    "fromAddress" TEXT,
    "fromDomain" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "replyToAddresses" TEXT[],
    "toRecipients" JSONB NOT NULL,
    "ccRecipients" JSONB,
    "bccRecipients" JSONB,
    "replyToRecipients" JSONB,
    "subject" TEXT,
    "messageId" TEXT,
    "inReplyTo" TEXT,
    "references" TEXT[],
    "headers" JSONB,
    "htmlBody" TEXT,
    "textBody" TEXT,
    "rawMessageDownloadUrl" TEXT,
    "rawMessageExpiresAt" TIMESTAMP(3),
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "rawWebhook" JSONB,
    "rawReceivingEmail" JSONB,
    "source" TEXT NOT NULL DEFAULT 'webhook',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmailAttachment" (
    "id" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "resendAttachmentId" TEXT NOT NULL,
    "filename" TEXT,
    "contentType" TEXT,
    "contentDisposition" TEXT,
    "contentId" TEXT,
    "sizeBytes" INTEGER,
    "downloadUrl" TEXT,
    "downloadExpiresAt" TIMESTAMP(3),
    "storageBucket" TEXT,
    "storagePath" TEXT,
    "storagePublicUrl" TEXT,
    "storageUploadedAt" TIMESTAMP(3),
    "sha256" TEXT,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmailAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_resendEmailId_key" ON "InboundEmail"("resendEmailId");

-- CreateIndex
CREATE INDEX "InboundEmail_createdAt_idx" ON "InboundEmail"("createdAt");

-- CreateIndex
CREATE INDEX "InboundEmail_fromAddress_idx" ON "InboundEmail"("fromAddress");

-- CreateIndex
CREATE INDEX "InboundEmail_fromDomain_idx" ON "InboundEmail"("fromDomain");

-- CreateIndex
CREATE INDEX "InboundEmail_subject_idx" ON "InboundEmail"("subject");

-- CreateIndex
CREATE INDEX "InboundEmailAttachment_resendAttachmentId_idx" ON "InboundEmailAttachment"("resendAttachmentId");

-- CreateIndex
CREATE INDEX "InboundEmailAttachment_storageBucket_storagePath_idx" ON "InboundEmailAttachment"("storageBucket", "storagePath");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmailAttachment_emailId_resendAttachmentId_key" ON "InboundEmailAttachment"("emailId", "resendAttachmentId");

-- AddForeignKey
ALTER TABLE "InboundEmailAttachment" ADD CONSTRAINT "InboundEmailAttachment_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;

