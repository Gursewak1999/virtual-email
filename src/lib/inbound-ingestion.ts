import { createHash } from "node:crypto";

import { Prisma } from "@prisma/client";
import type {
  AttachmentData,
  EmailReceivedEvent,
  GetReceivingEmailResponseSuccess,
} from "resend";

import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/resend";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

type IngestionSource = "webhook" | "backfill";

interface ParsedMailbox {
  raw: string;
  name: string | null;
  address: string | null;
  localPart: string | null;
  domain: string | null;
}

interface NormalizedAttachment {
  id: string;
  filename: string | null;
  size: number | null;
  contentType: string | null;
  contentDisposition: string | null;
  contentId: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
}

interface UploadResult {
  bucket: string;
  storagePath: string;
  publicUrl: string | null;
  sha256: string;
  uploadedAt: Date;
  sizeBytes: number;
}

export interface IngestInboundEmailInput {
  resendEmailId: string;
  source: IngestionSource;
  webhookEvent?: EmailReceivedEvent;
  rawWebhook?: unknown;
}

export interface IngestInboundEmailResult {
  skipped: boolean;
  reason?: string;
  emailId?: string;
  resendEmailId: string;
  attachmentCount: number;
  uploadedAttachmentCount: number;
}

const DEFAULT_ATTACHMENT_BUCKET = "inbound-email-attachments";
let attachmentBucketReadyPromise: Promise<void> | null = null;

function asErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function parseDateOrNull(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function toJson(value: unknown): Prisma.InputJsonValue {
  const serialized = JSON.stringify(value ?? null);
  return JSON.parse(serialized) as Prisma.InputJsonValue;
}

function getHeaderValue(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | null {
  if (!headers) {
    return null;
  }

  const target = name.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() === target) {
      return headerValue;
    }
  }

  return null;
}

function parseReferencesHeader(value: string | null): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .map((item) => item.replace(/^<|>$/g, ""))
    .filter(Boolean);
}

function parseMailbox(raw: string): ParsedMailbox {
  const trimmed = raw.trim();
  const mailboxMatch = trimmed.match(/^(?:\"?([^\"<>]*)\"?\s*)?<([^<>]+)>$/);

  let name: string | null = null;
  let address: string | null = null;

  if (mailboxMatch) {
    name = mailboxMatch[1]?.trim() || null;
    address = mailboxMatch[2]?.trim().toLowerCase() || null;
  } else if (trimmed.includes("@")) {
    address = trimmed.replace(/^mailto:/i, "").toLowerCase();
  }

  const atIndex = address?.lastIndexOf("@") ?? -1;
  const localPart = atIndex > 0 && address ? address.slice(0, atIndex) : null;
  const domain = atIndex > 0 && address ? address.slice(atIndex + 1) : null;

  return {
    raw,
    name,
    address,
    localPart,
    domain,
  };
}

function parseMailboxList(
  values: string[] | null | undefined,
): ParsedMailbox[] {
  if (!values || values.length === 0) {
    return [];
  }

  return values.map(parseMailbox);
}

function collectAddresses(values: ParsedMailbox[]): string[] {
  return values
    .map((item) => item.address)
    .filter((item): item is string => Boolean(item));
}

function shouldIngestForDomain(addresses: string[]): boolean {
  const inboundDomain = process.env.RESEND_INBOUND_DOMAIN?.trim().toLowerCase();
  if (!inboundDomain) {
    return true;
  }

  return addresses.some((address) =>
    address.toLowerCase().endsWith(`@${inboundDomain}`),
  );
}

function sanitizeFileName(fileName: string | null, fallbackId: string): string {
  const fallback = `attachment-${fallbackId}`;
  const normalized = (fileName ?? fallback).trim();
  const sanitized = normalized.replace(/[^a-zA-Z0-9._-]/g, "_");

  return sanitized.length > 0 ? sanitized : fallback;
}

function getAttachmentBucket(): string {
  return (
    process.env.SUPABASE_EMAIL_ATTACHMENTS_BUCKET?.trim() ||
    DEFAULT_ATTACHMENT_BUCKET
  );
}

function isAttachmentBucketPublic(): boolean {
  return process.env.SUPABASE_EMAIL_ATTACHMENTS_PUBLIC === "true";
}

function isBucketMissing(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("not found") || normalized.includes("does not exist")
  );
}

function isBucketAlreadyExists(message: string): boolean {
  return message.toLowerCase().includes("already exists");
}

async function ensureAttachmentBucket(bucketName: string): Promise<void> {
  if (attachmentBucketReadyPromise) {
    return attachmentBucketReadyPromise;
  }

  attachmentBucketReadyPromise = (async () => {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage.getBucket(bucketName);

    if (error && !isBucketMissing(error.message)) {
      throw new Error(
        `Failed to read Supabase bucket ${bucketName}: ${error.message}`,
      );
    }

    if (!data) {
      const { error: createError } = await supabase.storage.createBucket(
        bucketName,
        {
          public: isAttachmentBucketPublic(),
        },
      );

      if (createError && !isBucketAlreadyExists(createError.message)) {
        throw new Error(
          `Failed to create Supabase bucket ${bucketName}: ${createError.message}`,
        );
      }
    }
  })().catch((error) => {
    attachmentBucketReadyPromise = null;
    throw error;
  });

  return attachmentBucketReadyPromise;
}

function normalizeAttachmentsFromWebhook(
  event: EmailReceivedEvent | undefined,
): NormalizedAttachment[] {
  if (!event) {
    return [];
  }

  return event.data.attachments.map((attachment) => ({
    id: attachment.id,
    filename: attachment.filename,
    size: null,
    contentType: attachment.content_type,
    contentDisposition: attachment.content_disposition,
    contentId: attachment.content_id,
    downloadUrl: null,
    expiresAt: null,
  }));
}

async function listReceivingAttachments(
  resendEmailId: string,
  webhookEvent: EmailReceivedEvent | undefined,
): Promise<NormalizedAttachment[]> {
  const resend = getResendClient();
  const response = await resend.emails.receiving.attachments.list({
    emailId: resendEmailId,
    limit: 100,
  });

  const fallback = normalizeAttachmentsFromWebhook(webhookEvent);

  if (response.error || !response.data) {
    return fallback;
  }

  const merged = new Map<string, NormalizedAttachment>();

  response.data.data.forEach((attachment: AttachmentData) => {
    merged.set(attachment.id, {
      id: attachment.id,
      filename: attachment.filename ?? null,
      size: attachment.size,
      contentType: attachment.content_type,
      contentDisposition: attachment.content_disposition,
      contentId: attachment.content_id ?? null,
      downloadUrl: attachment.download_url,
      expiresAt: attachment.expires_at,
    });
  });

  fallback.forEach((attachment) => {
    if (!merged.has(attachment.id)) {
      merged.set(attachment.id, attachment);
    }
  });

  return [...merged.values()];
}

async function uploadAttachmentToSupabase(
  resendEmailId: string,
  attachment: NormalizedAttachment,
): Promise<UploadResult | null> {
  if (!attachment.downloadUrl) {
    return null;
  }

  const response = await fetch(attachment.downloadUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download attachment ${attachment.id} from Resend. HTTP ${response.status}.`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const bucketName = getAttachmentBucket();
  await ensureAttachmentBucket(bucketName);

  const safeFileName = sanitizeFileName(attachment.filename, attachment.id);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const storagePath = `${datePrefix}/${resendEmailId}/${attachment.id}-${safeFileName}`;

  const supabase = getSupabaseAdminClient();
  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(storagePath, bytes, {
      contentType: attachment.contentType ?? "application/octet-stream",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(
      `Failed to upload attachment ${attachment.id} to Supabase: ${uploadError.message}`,
    );
  }

  const publicUrl = isAttachmentBucketPublic()
    ? supabase.storage.from(bucketName).getPublicUrl(storagePath).data.publicUrl
    : null;

  return {
    bucket: bucketName,
    storagePath,
    publicUrl,
    sha256,
    uploadedAt: new Date(),
    sizeBytes: bytes.byteLength,
  };
}

export async function ingestInboundEmail(
  input: IngestInboundEmailInput,
): Promise<IngestInboundEmailResult> {
  const resend = getResendClient();
  const receivedEmailResponse = await resend.emails.receiving.get(
    input.resendEmailId,
  );

  if (receivedEmailResponse.error || !receivedEmailResponse.data) {
    throw new Error(
      `Resend could not return inbound email ${input.resendEmailId}: ${receivedEmailResponse.error?.message ?? "Unknown error"}`,
    );
  }

  const receivedEmail: GetReceivingEmailResponseSuccess =
    receivedEmailResponse.data;

  const fromMailbox = parseMailbox(receivedEmail.from);
  const toMailboxes = parseMailboxList(receivedEmail.to);
  const ccMailboxes = parseMailboxList(receivedEmail.cc);
  const bccMailboxes = parseMailboxList(receivedEmail.bcc);
  const replyToMailboxes = parseMailboxList(receivedEmail.reply_to);

  const toAddresses = collectAddresses(toMailboxes);
  const ccAddresses = collectAddresses(ccMailboxes);
  const bccAddresses = collectAddresses(bccMailboxes);
  const replyToAddresses = collectAddresses(replyToMailboxes);

  const allRecipientAddresses = [
    ...toAddresses,
    ...ccAddresses,
    ...bccAddresses,
    ...replyToAddresses,
  ];

  if (!shouldIngestForDomain(allRecipientAddresses)) {
    return {
      skipped: true,
      reason: "Email does not match RESEND_INBOUND_DOMAIN recipient filter.",
      resendEmailId: input.resendEmailId,
      attachmentCount: 0,
      uploadedAttachmentCount: 0,
    };
  }

  const headers = receivedEmail.headers;
  const attachments = await listReceivingAttachments(
    input.resendEmailId,
    input.webhookEvent,
  );

  const messageId =
    receivedEmail.message_id || input.webhookEvent?.data.message_id || null;
  const inReplyTo = getHeaderValue(headers, "in-reply-to");
  const references = parseReferencesHeader(
    getHeaderValue(headers, "references"),
  );

  const webhookCreatedAt = parseDateOrNull(input.webhookEvent?.created_at);
  const resendCreatedAt = parseDateOrNull(receivedEmail.created_at);
  const rawMessageExpiresAt = parseDateOrNull(
    receivedEmail.raw?.expires_at ?? null,
  );

  const emailRecord = await prisma.inboundEmail.upsert({
    where: {
      resendEmailId: input.resendEmailId,
    },
    create: {
      resendEmailId: input.resendEmailId,
      webhookEventType: input.webhookEvent?.type ?? "email.received",
      webhookCreatedAt,
      resendCreatedAt,
      fromRaw: receivedEmail.from,
      fromName: fromMailbox.name,
      fromAddress: fromMailbox.address,
      fromDomain: fromMailbox.domain,
      toAddresses,
      ccAddresses,
      bccAddresses,
      replyToAddresses,
      toRecipients: toJson(toMailboxes),
      ccRecipients:
        ccMailboxes.length > 0 ? toJson(ccMailboxes) : Prisma.JsonNull,
      bccRecipients:
        bccMailboxes.length > 0 ? toJson(bccMailboxes) : Prisma.JsonNull,
      replyToRecipients:
        replyToMailboxes.length > 0
          ? toJson(replyToMailboxes)
          : Prisma.JsonNull,
      subject: receivedEmail.subject,
      messageId,
      inReplyTo,
      references,
      headers: headers ? toJson(headers) : Prisma.JsonNull,
      htmlBody: receivedEmail.html,
      textBody: receivedEmail.text,
      rawMessageDownloadUrl: receivedEmail.raw?.download_url ?? null,
      rawMessageExpiresAt,
      attachmentCount: attachments.length,
      rawWebhook: input.rawWebhook ? toJson(input.rawWebhook) : Prisma.JsonNull,
      rawReceivingEmail: toJson(receivedEmail),
      source: input.source,
    },
    update: {
      webhookEventType: input.webhookEvent?.type ?? "email.received",
      webhookCreatedAt,
      webhookReceivedAt: new Date(),
      resendCreatedAt,
      fromRaw: receivedEmail.from,
      fromName: fromMailbox.name,
      fromAddress: fromMailbox.address,
      fromDomain: fromMailbox.domain,
      toAddresses,
      ccAddresses,
      bccAddresses,
      replyToAddresses,
      toRecipients: toJson(toMailboxes),
      ccRecipients:
        ccMailboxes.length > 0 ? toJson(ccMailboxes) : Prisma.JsonNull,
      bccRecipients:
        bccMailboxes.length > 0 ? toJson(bccMailboxes) : Prisma.JsonNull,
      replyToRecipients:
        replyToMailboxes.length > 0
          ? toJson(replyToMailboxes)
          : Prisma.JsonNull,
      subject: receivedEmail.subject,
      messageId,
      inReplyTo,
      references,
      headers: headers ? toJson(headers) : Prisma.JsonNull,
      htmlBody: receivedEmail.html,
      textBody: receivedEmail.text,
      rawMessageDownloadUrl: receivedEmail.raw?.download_url ?? null,
      rawMessageExpiresAt,
      attachmentCount: attachments.length,
      rawWebhook: input.rawWebhook ? toJson(input.rawWebhook) : undefined,
      rawReceivingEmail: toJson(receivedEmail),
      source: input.source,
    },
  });

  let uploadedAttachmentCount = 0;

  for (const attachment of attachments) {
    let uploadResult: UploadResult | null = null;
    let uploadError: string | null = null;

    try {
      uploadResult = await uploadAttachmentToSupabase(
        input.resendEmailId,
        attachment,
      );
      if (uploadResult) {
        uploadedAttachmentCount += 1;
      }
    } catch (error) {
      uploadError = asErrorMessage(error);
    }

    await prisma.inboundEmailAttachment.upsert({
      where: {
        emailId_resendAttachmentId: {
          emailId: emailRecord.id,
          resendAttachmentId: attachment.id,
        },
      },
      create: {
        emailId: emailRecord.id,
        resendAttachmentId: attachment.id,
        filename: attachment.filename,
        contentType: attachment.contentType,
        contentDisposition: attachment.contentDisposition,
        contentId: attachment.contentId,
        sizeBytes: uploadResult?.sizeBytes ?? attachment.size,
        downloadUrl: attachment.downloadUrl,
        downloadExpiresAt: parseDateOrNull(attachment.expiresAt),
        storageBucket: uploadResult?.bucket ?? null,
        storagePath: uploadResult?.storagePath ?? null,
        storagePublicUrl: uploadResult?.publicUrl ?? null,
        storageUploadedAt: uploadResult?.uploadedAt ?? null,
        sha256: uploadResult?.sha256 ?? null,
        rawMetadata: toJson({
          attachment,
          uploadError,
        }),
      },
      update: {
        filename: attachment.filename,
        contentType: attachment.contentType,
        contentDisposition: attachment.contentDisposition,
        contentId: attachment.contentId,
        sizeBytes: uploadResult?.sizeBytes ?? attachment.size,
        downloadUrl: attachment.downloadUrl,
        downloadExpiresAt: parseDateOrNull(attachment.expiresAt),
        storageBucket: uploadResult?.bucket ?? null,
        storagePath: uploadResult?.storagePath ?? null,
        storagePublicUrl: uploadResult?.publicUrl ?? null,
        storageUploadedAt: uploadResult?.uploadedAt ?? null,
        sha256: uploadResult?.sha256 ?? null,
        rawMetadata: toJson({
          attachment,
          uploadError,
        }),
      },
    });
  }

  if (emailRecord.attachmentCount !== attachments.length) {
    await prisma.inboundEmail.update({
      where: {
        id: emailRecord.id,
      },
      data: {
        attachmentCount: attachments.length,
      },
    });
  }

  return {
    skipped: false,
    emailId: emailRecord.id,
    resendEmailId: input.resendEmailId,
    attachmentCount: attachments.length,
    uploadedAttachmentCount,
  };
}
