import writeXlsxFile, {
  type CellObject,
  type SheetData,
} from "write-excel-file/node";

import type { EducationLevel } from "@/lib/profile-records";

export type TranscriptTemplateLocale = "en" | "vi";

const headerStyle = {
  align: "center",
  alignVertical: "center",
  backgroundColor: "#DCE6F1",
  borderColor: "#9EADBD",
  borderStyle: "thin",
  fontWeight: "bold",
  height: 28,
  wrap: true,
} satisfies Omit<CellObject, "value">;

function header(value: string): CellObject {
  return { value, ...headerStyle };
}

function guideData(
  level: EducationLevel,
  scoreScale: 4 | 10,
  locale: TranscriptTemplateLocale,
): SheetData {
  const isHighSchool = level === "HIGH_SCHOOL";
  if (locale === "en") {
    return [
      [header("TRANSCRIPT IMPORT GUIDE")],
      ["1. Enter one subject per row in the Transcript sheet."],
      [
        isHighSchool
          ? "2. Use a separate copy of this template for Grades 10, 11, and 12."
          : `2. Scores must use the selected ${scoreScale}-point scale.`,
      ],
      ["3. Replace the example rows with your actual transcript data."],
      ["4. Keep the column names unchanged and save the file as .xlsx."],
    ];
  }

  return [
    [header("HƯỚNG DẪN NHẬP BẢNG ĐIỂM")],
    ["1. Mỗi dòng trong trang Bảng điểm tương ứng với một môn học."],
    [
      isHighSchool
        ? "2. Dùng một bản riêng của file này để nhập bảng điểm lớp 10, lớp 11 và lớp 12."
        : `2. Điểm phải theo đúng thang ${scoreScale} đã chọn.`,
    ],
    ["3. Thay các dòng ví dụ bằng dữ liệu bảng điểm thực tế của bạn."],
    ["4. Không đổi tên cột và lưu file ở định dạng .xlsx."],
  ];
}

function transcriptData(
  level: EducationLevel,
  scoreScale: 4 | 10,
  locale: TranscriptTemplateLocale,
): SheetData {
  if (level === "HIGH_SCHOOL") {
    return locale === "en"
      ? [
          [header("Subject"), header("Score")],
          ["Mathematics", 8.5],
          ["Literature", 8],
          ["English", 8.7],
        ]
      : [
          [header("Môn học"), header("Điểm trung bình cả năm")],
          ["Toán", 8.5],
          ["Ngữ văn", 8],
          ["Tiếng Anh", 8.7],
        ];
  }

  const scores = scoreScale === 4 ? [3.5, 4, 3.2] : [8.5, 9, 8];
  return locale === "en"
    ? [
        [header("Subject"), header("Credits"), header("Score")],
        ["Data Structures", 3, scores[0]],
        ["Database Systems", 3, scores[1]],
        ["Research Methods", 2, scores[2]],
      ]
    : [
        [header("Môn học"), header("Tín chỉ"), header("Điểm")],
        ["Cấu trúc dữ liệu", 3, scores[0]],
        ["Cơ sở dữ liệu", 3, scores[1]],
        ["Phương pháp nghiên cứu", 2, scores[2]],
      ];
}

export async function createTranscriptTemplate(
  level: EducationLevel,
  scoreScale: 4 | 10,
  locale: TranscriptTemplateLocale,
) {
  const normalizedScale = level === "HIGH_SCHOOL" ? 10 : scoreScale;
  const transcriptSheet = locale === "vi" ? "Bảng điểm" : "Transcript";
  const guideSheet = locale === "vi" ? "Hướng dẫn" : "Guide";
  const buffer = await writeXlsxFile(
    [
      {
        data: transcriptData(level, normalizedScale, locale),
        sheet: transcriptSheet,
        columns:
          level === "HIGH_SCHOOL"
            ? [{ width: 32 }, { width: 24 }]
            : [{ width: 34 }, { width: 14 }, { width: 14 }],
        showGridLines: false,
        stickyRowsCount: 1,
      },
      {
        data: guideData(level, normalizedScale, locale),
        sheet: guideSheet,
        columns: [{ width: 86 }],
        showGridLines: false,
      },
    ],
    { fontFamily: "Arial", fontSize: 11 },
  ).toBuffer();

  return buffer;
}

export function transcriptTemplateFileName(
  level: EducationLevel,
  scoreScale: 4 | 10,
  locale: TranscriptTemplateLocale,
) {
  const levelName = {
    en: {
      GRADUATE: "graduate",
      HIGH_SCHOOL: "high-school",
      UNDERGRADUATE: "university",
    },
    vi: {
      GRADUATE: "cao-hoc",
      HIGH_SCHOOL: "thpt",
      UNDERGRADUATE: "dai-hoc",
    },
  }[locale][level];
  const scale = level === "HIGH_SCHOOL" ? "10" : String(scoreScale);
  return locale === "vi"
    ? `mau-bang-diem-${levelName}-thang-${scale}.xlsx`
    : `${levelName}-transcript-template-${scale}-point.xlsx`;
}
