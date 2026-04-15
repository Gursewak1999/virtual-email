-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VirtualMailbox" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "emailAddress" TEXT NOT NULL,
    "label" TEXT,
    "passwordCiphertext" TEXT NOT NULL,
    "passwordIv" TEXT NOT NULL,
    "passwordTag" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VirtualMailbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SentEmail" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mailboxId" TEXT NOT NULL,
    "resendEmailId" TEXT,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "subject" TEXT,
    "textBody" TEXT,
    "htmlBody" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "replyToInboundEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SentEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualMailbox_emailAddress_key" ON "VirtualMailbox"("emailAddress");

-- CreateIndex
CREATE INDEX "VirtualMailbox_ownerId_idx" ON "VirtualMailbox"("ownerId");

-- CreateIndex
CREATE INDEX "VirtualMailbox_emailAddress_idx" ON "VirtualMailbox"("emailAddress");

-- CreateIndex
CREATE UNIQUE INDEX "VirtualMailbox_ownerId_passportId_key" ON "VirtualMailbox"("ownerId", "passportId");

-- CreateIndex
CREATE INDEX "SentEmail_ownerId_createdAt_idx" ON "SentEmail"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "SentEmail_mailboxId_createdAt_idx" ON "SentEmail"("mailboxId", "createdAt");

-- AddForeignKey
ALTER TABLE "VirtualMailbox" ADD CONSTRAINT "VirtualMailbox_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SentEmail" ADD CONSTRAINT "SentEmail_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "VirtualMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;
