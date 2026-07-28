import { getViewer } from "@/lib/auth/dal";
import {
  EDUCATION_LEVELS,
  type EducationLevel,
} from "@/lib/profile-records";
import {
  createTranscriptTemplate,
  transcriptTemplateFileName,
  type TranscriptTemplateLocale,
} from "@/lib/transcript-template";

const xlsxMimeType =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function educationLevel(value: string | null): EducationLevel | null {
  return EDUCATION_LEVELS.includes(value as EducationLevel)
    ? (value as EducationLevel)
    : null;
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer || viewer.actor.kind !== "user") {
    return new Response("Unauthorized", { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const level = educationLevel(searchParams.get("level"));
  if (!level) {
    return new Response("Invalid education level", { status: 400 });
  }

  const scoreScale = searchParams.get("scale") === "10" ? 10 : 4;
  const locale: TranscriptTemplateLocale =
    searchParams.get("locale") === "en" ? "en" : "vi";
  const buffer = await createTranscriptTemplate(level, scoreScale, locale);
  const fileName = transcriptTemplateFileName(level, scoreScale, locale);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Content-Type": xlsxMimeType,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
