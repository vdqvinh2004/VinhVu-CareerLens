import type { ToolDataClass } from "../agent/tools";

const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PHONE_PATTERN = /(?:^|\D)(?:(?:\+?84|0)[ .-]?)?(?:\d[ .-]?){9,10}(?:\D|$)/;
const NATIONAL_ID_PATTERN = /(?:^|\D)(?:\d[ .-]?){9}(?:(?:\d[ .-]?){3})?(?:\D|$)/;
const PASSPORT_PATTERN = /\b[A-Z][0-9]{7,8}\b/i;
const PERSONAL_LABEL_PATTERN =
  /\b(?:email|e-mail|phone|mobile|telephone|address|passport|identity|student id)\s*:/i;
const VIETNAMESE_PERSONAL_LABEL_PATTERN =
  /(?:e-mail|email|số điện thoại|điện thoại|địa chỉ|căn cước|cccd|cmnd|hộ chiếu|mã sinh viên)\s*:/iu;
const FULL_NAME_DISCLOSURE_PATTERN =
  /\bmy (?:full )?name is\b|(?:họ và tên (?:của )?tôi|tên tôi)\s+là/iu;
const SELF_IDENTIFICATION_PATTERN =
  /(?:\b[Ii] am|\b[Ii]['’]m)\s+\p{Lu}[\p{L}'’-]+(?:[ \t]+\p{Lu}[\p{L}'’-]+){1,4}(?=$|[\s,.;!?])|[Tt]ôi là\s+\p{Lu}[\p{L}'’-]+(?:[ \t]+\p{Lu}[\p{L}'’-]+){2,4}(?=$|[\s,.;!?])/u;
const OWN_ADDRESS_PATTERN =
  /\b(?:I (?:live|reside) at|my (?:home )?address is)\b|(?:tôi sống tại|tôi cư trú tại|địa chỉ (?:của )?tôi là)/iu;
const ENGLISH_NUMBERED_STREET_PATTERN =
  /(?:^|[\s,;])(?!19\d{2}\b|20\d{2}\b)\d{1,4}[A-Z]?(?:[/-]\d{1,4}[A-Z]?)?[ \t]+(?:[\p{L}.'’-]+[ \t]+){1,5}(?:street|st\.?|road|rd\.?|avenue|ave\.?|boulevard|blvd\.?|lane|ln\.?|drive|dr\.?)\b/iu;
const VIETNAMESE_NUMBERED_STREET_PATTERN =
  /(?:^|[\s,;])(?!19\d{2}\b|20\d{2}\b)\d{1,4}[A-Z]?(?:[/-]\d{1,4}[A-Z]?)?[ \t]+(?:đường|phố)[ \t]+[\p{L}\d.'’-]+/iu;
const LABELED_STREET_ADDRESS_PATTERN =
  /\baddress\s*(?:is\s*)?:?\s*\d{1,4}\b|địa chỉ\s*(?:là\s*)?:?\s*\d{1,4}\b/iu;

const OWN_DOCUMENT_PATTERN =
  /\b(?:my (?:cv|resume|résumé)|attached (?:cv|resume|document)|private document|personal statement)\b|(?:cv|hồ sơ|sơ yếu lý lịch|tài liệu|đơn xin việc)\s+(?:của tôi|đính kèm|bên dưới)/iu;
const DOCUMENT_HEADING_PATTERN =
  /^(?:curriculum vitae|resume|résumé|work experience|education|skills|career objective|references|kinh nghiệm làm việc|học vấn|kỹ năng|mục tiêu nghề nghiệp|thông tin cá nhân)\s*:?[ \t]*$/gimu;

export type ChatDataClassification = ReadonlySet<ToolDataClass>;

export function classifyChatText(text: string): ChatDataClassification {
  const classes = new Set<ToolDataClass>(["public"]);
  if (
    EMAIL_PATTERN.test(text) ||
    PHONE_PATTERN.test(text) ||
    NATIONAL_ID_PATTERN.test(text) ||
    PASSPORT_PATTERN.test(text) ||
    PERSONAL_LABEL_PATTERN.test(text) ||
    VIETNAMESE_PERSONAL_LABEL_PATTERN.test(text) ||
    FULL_NAME_DISCLOSURE_PATTERN.test(text) ||
    SELF_IDENTIFICATION_PATTERN.test(text) ||
    OWN_ADDRESS_PATTERN.test(text) ||
    ENGLISH_NUMBERED_STREET_PATTERN.test(text) ||
    VIETNAMESE_NUMBERED_STREET_PATTERN.test(text) ||
    LABELED_STREET_ADDRESS_PATTERN.test(text)
  ) {
    classes.add("personal_data");
  }

  const headings = text.match(DOCUMENT_HEADING_PATTERN)?.length ?? 0;
  if (OWN_DOCUMENT_PATTERN.test(text) || headings >= 2) {
    classes.add("private_document");
  }
  return classes;
}

export function classifyChatConversation(
  texts: Iterable<string>,
): ChatDataClassification {
  const classes = new Set<ToolDataClass>(["public"]);
  for (const text of texts) {
    for (const dataClass of classifyChatText(text)) classes.add(dataClass);
  }
  return classes;
}

export function isPrivateChatClassification(
  classification: ChatDataClassification,
): boolean {
  return (
    classification.has("personal_data") ||
    classification.has("private_document")
  );
}
