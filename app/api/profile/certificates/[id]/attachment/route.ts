import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { getViewer } from "@/lib/auth/dal";
import { getDb } from "@/lib/db";
import { certificateAttachments, certificates } from "@/lib/db/schema";

function contentDisposition(fileName: string) {
  const safeName = fileName.replace(/[\r\n"\\]/g, "_");
  return `inline; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/profile/certificates/[id]/attachment">,
) {
  const viewer = await getViewer();
  if (!viewer || viewer.actor.kind !== "user") {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  if (!z.string().uuid().safeParse(id).success) {
    return new Response("Not found", { status: 404 });
  }
  const [attachment] = await getDb()
    .select({
      data: certificateAttachments.data,
      fileName: certificateAttachments.fileName,
      mimeType: certificateAttachments.mimeType,
    })
    .from(certificateAttachments)
    .innerJoin(
      certificates,
      eq(certificates.id, certificateAttachments.certificateId),
    )
    .where(
      and(
        eq(certificates.id, id),
        eq(certificates.userId, viewer.actor.userId),
      ),
    )
    .limit(1);

  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(new Uint8Array(attachment.data), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDisposition(attachment.fileName),
      "Content-Type": attachment.mimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
