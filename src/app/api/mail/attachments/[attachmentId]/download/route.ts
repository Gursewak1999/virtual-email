import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

interface RouteParams {
  params: Promise<{ attachmentId: string }>;
}

export async function GET(
  _request: Request,
  { params }: RouteParams,
): Promise<NextResponse> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { attachmentId } = await params;

  const userMailboxes = await prisma.virtualMailbox.findMany({
    where: {
      ownerId: sessionUser.id,
    },
    select: {
      emailAddress: true,
    },
  });

  const mailboxAddresses = userMailboxes.map((item) => item.emailAddress);
  if (mailboxAddresses.length === 0) {
    return NextResponse.json(
      { ok: false, error: "No mailbox access" },
      { status: 404 },
    );
  }

  const attachment = await prisma.inboundEmailAttachment.findFirst({
    where: {
      id: attachmentId,
      email: {
        toAddresses: {
          hasSome: mailboxAddresses,
        },
      },
    },
    select: {
      id: true,
      downloadUrl: true,
      storageBucket: true,
      storagePath: true,
      storagePublicUrl: true,
    },
  });

  if (!attachment) {
    return NextResponse.json(
      { ok: false, error: "Attachment not found" },
      { status: 404 },
    );
  }

  if (attachment.storagePublicUrl) {
    return NextResponse.redirect(attachment.storagePublicUrl);
  }

  if (attachment.storageBucket && attachment.storagePath) {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.storage
      .from(attachment.storageBucket)
      .createSignedUrl(attachment.storagePath, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: error?.message ?? "Could not generate signed URL",
        },
        { status: 500 },
      );
    }

    return NextResponse.redirect(data.signedUrl);
  }

  if (attachment.downloadUrl) {
    return NextResponse.redirect(attachment.downloadUrl);
  }

  return NextResponse.json(
    {
      ok: false,
      error: "Attachment does not have a downloadable source",
    },
    { status: 404 },
  );
}
