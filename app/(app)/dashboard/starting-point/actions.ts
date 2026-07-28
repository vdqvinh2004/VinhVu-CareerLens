"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { recordAuditEvent } from "@/lib/auth/audit";
import { requireViewer } from "@/lib/auth/dal";
import {
  CV_IMPORT_MODEL,
  CvAiExtractionError,
  extractCvProfileData,
} from "@/lib/cv-import/ai";
import {
  extractCvPdf,
  CvPdfError,
  type CvPdfErrorCode,
} from "@/lib/cv-import/pdf";
import {
  persistCvImport,
  type CvImportCounts,
} from "@/lib/cv-import/persistence";

export type CvImportActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldError?: string }
  | {
      status: "success";
      message: string;
      imported: CvImportCounts;
      skippedDuplicates: number;
    };

const initialCvImportState: CvImportActionState = { status: "idle" };

function pdfErrorKey(code: CvPdfErrorCode) {
  return `cvImport.validation.${code}` as const;
}

export async function importCvAction(
  _previousState: CvImportActionState = initialCvImportState,
  formData: FormData,
): Promise<CvImportActionState> {
  void _previousState;
  const [viewer, t] = await Promise.all([
    requireViewer(),
    getTranslations("StartingPoint"),
  ]);

  if (viewer.actor.kind !== "user") {
    return { status: "error", message: t("cvImport.actions.unavailable") };
  }

  const value = formData.get("cvFile");
  const file = value instanceof File ? value : null;

  try {
    if (!file) throw new CvPdfError("required");

    const { text, pageCount, wasTruncated } = await extractCvPdf(file);
    const data = await extractCvProfileData({
      text,
      userId: viewer.actor.userId,
    });
    const extractedRecordCount =
      data.education.length +
      data.certificates.length +
      data.competitions.length +
      data.activities.length +
      data.workExperiences.length;
    if (extractedRecordCount === 0) throw new CvAiExtractionError();

    const result = await persistCvImport(viewer.actor.userId, data);

    try {
      await recordAuditEvent({
        actor: viewer.actor,
        action: "profile.cv.imported",
        targetType: "user_profile",
        targetId: viewer.actor.userId,
        metadata: {
          imported: result.imported,
          skippedDuplicates: result.skippedDuplicates,
          pageCount,
          wasTruncated,
          model: CV_IMPORT_MODEL,
        },
      });
    } catch (error) {
      console.error("Could not write CV import audit event", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    revalidatePath("/dashboard/starting-point");
    revalidatePath("/dashboard/careerlens");

    const totalImported = Object.values(result.imported).reduce(
      (total, count) => total + count,
      0,
    );
    return {
      status: "success",
      message:
        totalImported > 0
          ? t("cvImport.actions.saved", { count: totalImported })
          : t("cvImport.actions.noNewData"),
      ...result,
    };
  } catch (error) {
    if (error instanceof CvPdfError) {
      return {
        status: "error",
        message: t("cvImport.actions.checkFile"),
        fieldError: t(pdfErrorKey(error.code)),
      };
    }

    if (error instanceof CvAiExtractionError) {
      return { status: "error", message: t("cvImport.actions.analysisFailed") };
    }

    console.error("CV import failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: "error", message: t("cvImport.actions.failed") };
  }
}
