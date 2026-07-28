type SuggestionLocale = "vi" | "en";

const DEFAULT_SUGGESTIONS: Record<SuggestionLocale, readonly string[]> = {
  vi: ["Giải quyết vấn đề", "Làm sản phẩm thực tế", "Làm việc với con người", "Nghiên cứu và khám phá"],
  en: ["Problem solving", "Building real products", "Working with people", "Research and discovery"],
};

const SUGGESTION_RULES: Array<{
  pattern: RegExp;
  suggestions: Record<SuggestionLocale, readonly string[]>;
}> = [
  {
    pattern: /toán|logic|thống kê|phân tích|math|statistics|analysis/,
    suggestions: {
      vi: ["Phân tích dữ liệu", "AI và học máy", "Tài chính", "Tối ưu vận hành"],
      en: ["Data analysis", "AI and machine learning", "Finance", "Operations optimisation"],
    },
  },
  {
    pattern: /tin|lập trình|code|phần mềm|máy tính|công nghệ|programming|software|computer|technology/,
    suggestions: {
      vi: ["Phát triển phần mềm", "An toàn thông tin", "Dữ liệu và AI", "Tự động hóa"],
      en: ["Software development", "Information security", "Data and AI", "Automation"],
    },
  },
  {
    pattern: /văn|viết|ngữ văn|nội dung|kể chuyện|literature|writing|content|storytelling/,
    suggestions: {
      vi: ["Truyền thông", "Chiến lược nội dung", "Luật", "Nghiên cứu người dùng"],
      en: ["Communications", "Content strategy", "Law", "User research"],
    },
  },
  {
    pattern: /anh|ngoại ngữ|tiếng|ngôn ngữ|english|language/,
    suggestions: {
      vi: ["Kinh doanh quốc tế", "Biên phiên dịch", "Du lịch", "Customer Success"],
      en: ["International business", "Translation and interpreting", "Tourism", "Customer success"],
    },
  },
  {
    pattern: /sinh|hóa|y|dược|phòng thí nghiệm|biology|chemistry|medicine|pharmacy|laboratory/,
    suggestions: {
      vi: ["Công nghệ sinh học", "Chăm sóc sức khỏe", "Công nghệ thực phẩm", "Nghiên cứu phòng lab"],
      en: ["Biotechnology", "Healthcare", "Food technology", "Laboratory research"],
    },
  },
  {
    pattern: /lý|vật lý|điện|điện tử|cơ khí|sửa chữa|physics|electrical|electronics|mechanical|repair/,
    suggestions: {
      vi: ["Robot", "Tự động hóa", "Năng lượng tái tạo", "Thiết kế kỹ thuật"],
      en: ["Robotics", "Automation", "Renewable energy", "Engineering design"],
    },
  },
  {
    pattern: /vẽ|mỹ thuật|thiết kế|sáng tạo|âm nhạc|nghệ thuật|drawing|design|creative|music|art/,
    suggestions: {
      vi: ["Thiết kế sản phẩm", "UX/UI", "Truyền thông số", "Kiến trúc"],
      en: ["Product design", "UX/UI", "Digital media", "Architecture"],
    },
  },
  {
    pattern: /kinh doanh|marketing|bán hàng|tài chính|quản trị|business|sales|finance|management/,
    suggestions: {
      vi: ["Khởi nghiệp", "Marketing số", "Đầu tư", "Chuỗi cung ứng"],
      en: ["Entrepreneurship", "Digital marketing", "Investment", "Supply chain"],
    },
  },
  {
    pattern: /thể thao|bóng|chạy|bơi|cầu lông|sport|football|running|swimming|badminton/,
    suggestions: {
      vi: ["Quản lý thể thao", "Huấn luyện", "Truyền thông thể thao", "Phục hồi vận động"],
      en: ["Sports management", "Coaching", "Sports communications", "Sports rehabilitation"],
    },
  },
];

export function getInterestSuggestions(subjectOrSkill: string, locale: SuggestionLocale = "vi"): string[] {
  const normalized = subjectOrSkill.trim().toLocaleLowerCase("vi");
  const matched = SUGGESTION_RULES.filter(({ pattern }) => pattern.test(normalized)).flatMap(
    ({ suggestions }) => suggestions[locale],
  );

  return [...new Set(matched.length > 0 ? matched : DEFAULT_SUGGESTIONS[locale])].slice(0, 6);
}
