-- CreateTable
CREATE TABLE "InboundEmailRead" (
    "mailboxId" TEXT NOT NULL,
    "emailId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundEmailRead_pkey" PRIMARY KEY ("mailboxId","emailId")
);

-- CreateIndex
CREATE INDEX "InboundEmailRead_emailId_idx" ON "InboundEmailRead"("emailId");

-- CreateIndex
CREATE INDEX "InboundEmailRead_mailboxId_readAt_idx" ON "InboundEmailRead"("mailboxId", "readAt");

-- AddForeignKey
ALTER TABLE "InboundEmailRead" ADD CONSTRAINT "InboundEmailRead_mailboxId_fkey" FOREIGN KEY ("mailboxId") REFERENCES "VirtualMailbox"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmailRead" ADD CONSTRAINT "InboundEmailRead_emailId_fkey" FOREIGN KEY ("emailId") REFERENCES "InboundEmail"("id") ON DELETE CASCADE ON UPDATE CASCADE;
