import "server-only";

import type { LaborMarketSignals } from "./schemas";
import { getVietnamProvinceNames, VIETNAM_PROVINCES } from "./vietnam-provinces";

type Posting = LaborMarketSignals["postings"][number];
type EducationRequirement = Posting["education_requirement"];

type CareerFamilyTemplate = {
  careerFamily: string;
  industry: string;
  roles: readonly string[];
  skills: readonly string[];
  salaryMin: number;
  salaryMax: number;
  educationRequirement: EducationRequirement;
  culture: readonly string[];
  postingGrowthRate: number;
  salaryGrowthRate: number;
};

const CAREER_FAMILIES = [
  {
    careerFamily: "Phần mềm và điện toán đám mây",
    industry: "Công nghệ phần mềm",
    roles: ["Lập trình viên Frontend", "Lập trình viên Backend", "Lập trình viên Full-stack", "Lập trình viên Mobile", "Kiểm thử phần mềm", "Kỹ sư QA Automation", "Kỹ sư DevOps", "Kỹ sư Cloud", "Kỹ sư giải pháp", "Scrum Master"],
    skills: ["Lập trình", "Git", "Kiểm thử", "Cloud fundamentals"],
    salaryMin: 12_000_000,
    salaryMax: 28_000_000,
    educationRequirement: "flexible",
    culture: ["team_based", "hybrid"],
    postingGrowthRate: 13.2,
    salaryGrowthRate: 6.8,
  },
  {
    careerFamily: "Dữ liệu và trí tuệ nhân tạo",
    industry: "Dữ liệu và AI",
    roles: ["Data Analyst", "Business Intelligence Analyst", "Data Engineer", "Machine Learning Engineer", "AI Engineer", "Data Scientist", "Analytics Engineer", "Chuyên viên sản phẩm AI", "GIS Data Analyst", "Chuyên viên quản trị dữ liệu"],
    skills: ["SQL", "Python", "Data visualization", "Thống kê"],
    salaryMin: 13_000_000,
    salaryMax: 32_000_000,
    educationRequirement: "university",
    culture: ["independent", "team_based"],
    postingGrowthRate: 16.4,
    salaryGrowthRate: 8.1,
  },
  {
    careerFamily: "An toàn thông tin",
    industry: "An toàn thông tin",
    roles: ["SOC Analyst", "Chuyên viên kiểm thử xâm nhập", "Kỹ sư bảo mật", "Chuyên viên GRC", "Kỹ sư Cloud Security", "Chuyên viên ứng cứu sự cố", "Chuyên viên IAM", "Kỹ sư AppSec", "Kiểm toán viên an ninh", "Chuyên viên điều tra số"],
    skills: ["Network fundamentals", "Security monitoring", "Risk assessment", "Incident response"],
    salaryMin: 14_000_000,
    salaryMax: 34_000_000,
    educationRequirement: "certificate",
    culture: ["independent", "team_based"],
    postingGrowthRate: 15.1,
    salaryGrowthRate: 7.6,
  },
  {
    careerFamily: "Điện, điện tử và tự động hóa",
    industry: "Điện tử và tự động hóa",
    roles: ["Kỹ thuật viên tự động hóa", "Kỹ sư PLC", "Kỹ sư SCADA", "Kỹ sư cơ điện tử", "Kỹ sư robot", "Kỹ sư thiết kế điện", "Kỹ thuật viên bảo trì điện", "Kỹ sư IoT", "Kỹ sư đo lường điều khiển", "Kỹ sư quy trình công nghiệp"],
    skills: ["PLC", "Đọc bản vẽ điện", "Điều khiển tự động", "An toàn công nghiệp"],
    salaryMin: 10_000_000,
    salaryMax: 24_000_000,
    educationRequirement: "vocational",
    culture: ["hands_on", "fieldwork"],
    postingGrowthRate: 10.8,
    salaryGrowthRate: 5.7,
  },
  {
    careerFamily: "Cơ khí và sản xuất",
    industry: "Cơ khí chế tạo",
    roles: ["Kỹ sư thiết kế CAD", "Kỹ thuật viên CNC", "Kỹ sư chất lượng sản xuất", "Chuyên viên kế hoạch sản xuất", "Kỹ sư Lean", "Kỹ thuật viên bảo trì cơ khí", "Kỹ thuật viên hàn", "Kỹ sư khuôn mẫu", "Kỹ sư vật liệu", "Chuyên viên vận hành nhà máy"],
    skills: ["CAD", "Quản lý chất lượng", "Đọc bản vẽ", "Lean manufacturing"],
    salaryMin: 9_000_000,
    salaryMax: 22_000_000,
    educationRequirement: "college",
    culture: ["hands_on", "team_based"],
    postingGrowthRate: 8.7,
    salaryGrowthRate: 4.9,
  },
  {
    careerFamily: "Logistics và chuỗi cung ứng",
    industry: "Logistics và chuỗi cung ứng",
    roles: ["Điều phối logistics", "Chuyên viên kế hoạch cung ứng", "Chuyên viên thu mua", "Giám sát kho", "Chuyên viên xuất nhập khẩu", "Điều phối vận tải", "Demand Planner", "Điều phối đội xe", "Chuyên viên giao hàng chặng cuối", "Chuyên viên quản lý tồn kho"],
    skills: ["Operations planning", "Spreadsheet analysis", "Inventory management", "Vendor communication"],
    salaryMin: 9_000_000,
    salaryMax: 21_000_000,
    educationRequirement: "college",
    culture: ["team_based", "office"],
    postingGrowthRate: 11.6,
    salaryGrowthRate: 5.4,
  },
  {
    careerFamily: "Tài chính, kế toán và bảo hiểm",
    industry: "Tài chính và kế toán",
    roles: ["Kế toán tổng hợp", "Chuyên viên thuế", "Trợ lý kiểm toán", "Financial Analyst", "Chuyên viên tín dụng", "Chuyên viên quản trị rủi ro", "Chuyên viên nguồn vốn", "FP&A Analyst", "Chuyên viên phân tích đầu tư", "Chuyên viên nghiệp vụ bảo hiểm"],
    skills: ["Financial reporting", "Excel", "Risk analysis", "Accounting standards"],
    salaryMin: 10_000_000,
    salaryMax: 25_000_000,
    educationRequirement: "university",
    culture: ["office", "independent"],
    postingGrowthRate: 8.2,
    salaryGrowthRate: 5.3,
  },
  {
    careerFamily: "Kinh doanh và thương mại",
    industry: "Kinh doanh và bán hàng",
    roles: ["Chuyên viên kinh doanh B2B", "Account Manager", "Chuyên viên phát triển kinh doanh", "Sales Operations Analyst", "Customer Success Specialist", "Chuyên viên vận hành thương mại điện tử", "Quản lý bán lẻ", "Category Executive", "Revenue Analyst", "Chuyên viên phát triển nhượng quyền"],
    skills: ["Sales planning", "Đàm phán", "CRM", "Customer communication"],
    salaryMin: 9_000_000,
    salaryMax: 24_000_000,
    educationRequirement: "flexible",
    culture: ["team_based", "office"],
    postingGrowthRate: 10.5,
    salaryGrowthRate: 5.1,
  },
  {
    careerFamily: "Marketing và truyền thông",
    industry: "Marketing và truyền thông",
    roles: ["Digital Marketing Specialist", "Content Strategist", "Social Media Executive", "SEO Specialist", "Performance Marketing Specialist", "CRM Marketing Specialist", "Chuyên viên quan hệ công chúng", "Chuyên viên tổ chức sự kiện", "Brand Executive", "Chuyên viên nghiên cứu thị trường"],
    skills: ["Content strategy", "Marketing analytics", "Campaign operations", "Audience research"],
    salaryMin: 9_000_000,
    salaryMax: 23_000_000,
    educationRequirement: "college",
    culture: ["team_based", "creativity"],
    postingGrowthRate: 12.3,
    salaryGrowthRate: 5.9,
  },
  {
    careerFamily: "Thiết kế và sáng tạo",
    industry: "Thiết kế sáng tạo",
    roles: ["Product Designer", "UI Designer", "UX Researcher", "Graphic Designer", "Motion Designer", "3D Artist", "Industrial Designer", "Service Designer", "Interior Designer", "Art Director"],
    skills: ["User research", "Prototyping", "Visual communication", "Design systems"],
    salaryMin: 10_000_000,
    salaryMax: 26_000_000,
    educationRequirement: "flexible",
    culture: ["creativity", "project_based"],
    postingGrowthRate: 9.9,
    salaryGrowthRate: 5.8,
  },
  {
    careerFamily: "Giáo dục và đào tạo",
    industry: "Giáo dục và EdTech",
    roles: ["Giáo viên STEM", "Giáo viên tiếng Anh", "Giảng viên giáo dục nghề nghiệp", "Chuyên viên phát triển chương trình", "Learning Designer", "Chuyên viên tư vấn giáo dục", "Kỹ thuật viên phòng thí nghiệm trường học", "Chuyên viên sản phẩm EdTech", "Trợ giảng giáo dục đặc biệt", "Điều phối đào tạo"],
    skills: ["Instructional design", "Facilitation", "Đánh giá học tập", "Digital learning"],
    salaryMin: 8_000_000,
    salaryMax: 20_000_000,
    educationRequirement: "university",
    culture: ["team_based", "mentor_guided"],
    postingGrowthRate: 7.8,
    salaryGrowthRate: 4.6,
  },
  {
    careerFamily: "Y tế và chăm sóc sức khỏe",
    industry: "Y tế và chăm sóc sức khỏe",
    roles: ["Điều dưỡng viên", "Kỹ thuật viên xét nghiệm y học", "Dược sĩ", "Chuyên viên dinh dưỡng", "Kỹ thuật viên vật lý trị liệu", "Chuyên viên y tế công cộng", "Điều phối vận hành bệnh viện", "Chuyên viên mã hóa y khoa", "Kỹ thuật viên thiết bị y sinh", "Health Data Analyst"],
    skills: ["Clinical safety", "Hồ sơ chuyên môn", "Patient communication", "Quality control"],
    salaryMin: 9_000_000,
    salaryMax: 24_000_000,
    educationRequirement: "university",
    culture: ["hands_on", "team_based"],
    postingGrowthRate: 9.4,
    salaryGrowthRate: 5.2,
  },
  {
    careerFamily: "Sinh học và môi trường",
    industry: "Công nghệ sinh học và môi trường",
    roles: ["Kỹ thuật viên công nghệ sinh học", "Chuyên viên QC dược", "Kỹ thuật viên kiểm nghiệm thực phẩm", "Kỹ sư môi trường", "Kỹ sư xử lý nước", "Chuyên viên phát triển bền vững", "Kỹ sư nông nghiệp công nghệ cao", "Chuyên viên bảo vệ thực vật", "Kỹ sư nuôi trồng thủy sản", "Chuyên viên lâm nghiệp"],
    skills: ["Laboratory practice", "Environmental monitoring", "Quality control", "Scientific reporting"],
    salaryMin: 8_500_000,
    salaryMax: 21_000_000,
    educationRequirement: "university",
    culture: ["fieldwork", "hands_on"],
    postingGrowthRate: 8.9,
    salaryGrowthRate: 4.8,
  },
  {
    careerFamily: "Nông nghiệp và công nghệ thực phẩm",
    industry: "Nông nghiệp và thực phẩm",
    roles: ["Kỹ sư nông học", "Chuyên viên vận hành trang trại", "Kỹ sư công nghệ thực phẩm", "Điều phối sản xuất thực phẩm", "Chuyên viên QA thực phẩm", "Chuyên viên R&D thực phẩm", "Điều phối chuỗi lạnh", "Chuyên viên kinh doanh nông nghiệp", "Chuyên viên truy xuất nguồn gốc", "Kỹ thuật viên chăn nuôi"],
    skills: ["Food safety", "Farm operations", "Quality assurance", "Traceability"],
    salaryMin: 8_000_000,
    salaryMax: 20_000_000,
    educationRequirement: "college",
    culture: ["fieldwork", "hands_on"],
    postingGrowthRate: 7.7,
    salaryGrowthRate: 4.4,
  },
  {
    careerFamily: "Xây dựng và kiến trúc",
    industry: "Xây dựng và kiến trúc",
    roles: ["Kiến trúc sư", "Kỹ sư xây dựng dân dụng", "Kỹ sư MEP", "Kỹ sư dự toán", "BIM Engineer", "Kỹ sư trắc địa", "Giám sát công trường", "Chuyên viên an toàn xây dựng", "Chuyên viên quy hoạch đô thị", "Chuyên viên quản lý cơ sở vật chất"],
    skills: ["BIM", "Đọc bản vẽ", "Project coordination", "Construction safety"],
    salaryMin: 10_000_000,
    salaryMax: 25_000_000,
    educationRequirement: "university",
    culture: ["fieldwork", "team_based"],
    postingGrowthRate: 8.4,
    salaryGrowthRate: 5,
  },
  {
    careerFamily: "Du lịch và dịch vụ lưu trú",
    industry: "Du lịch và khách sạn",
    roles: ["Điều hành tour", "Hướng dẫn viên du lịch", "Nhân viên tiền sảnh khách sạn", "Revenue Executive khách sạn", "Giám sát nhà hàng", "Bếp trưởng ca", "Điều phối sự kiện du lịch", "Chuyên viên chăm sóc khách lưu trú", "Nhân viên dịch vụ hàng không", "Chuyên viên phát triển sản phẩm du lịch"],
    skills: ["Service operations", "Ngoại ngữ", "Guest communication", "Event coordination"],
    salaryMin: 8_000_000,
    salaryMax: 20_000_000,
    educationRequirement: "vocational",
    culture: ["team_based", "fieldwork"],
    postingGrowthRate: 11.1,
    salaryGrowthRate: 5.5,
  },
  {
    careerFamily: "Pháp lý và hành chính",
    industry: "Pháp lý và hành chính",
    roles: ["Chuyên viên pháp chế", "Trợ lý luật sư", "Chuyên viên tuân thủ", "Chuyên viên quản lý hợp đồng", "Chuyên viên nghiên cứu chính sách", "Chuyên viên hành chính công", "Chuyên viên lưu trữ", "Chuyên viên LegalTech", "Chuyên viên sở hữu trí tuệ", "Chuyên viên quan hệ lao động"],
    skills: ["Legal research", "Contract review", "Compliance", "Policy writing"],
    salaryMin: 9_000_000,
    salaryMax: 23_000_000,
    educationRequirement: "university",
    culture: ["office", "independent"],
    postingGrowthRate: 6.8,
    salaryGrowthRate: 4.5,
  },
  {
    careerFamily: "Báo chí, nội dung và văn hóa",
    industry: "Truyền thông và công nghiệp nội dung",
    roles: ["Phóng viên", "Biên tập viên", "Video Producer", "Kỹ thuật viên âm thanh", "Nhiếp ảnh gia thương mại", "Biên tập viên phát thanh truyền hình", "Game Content Designer", "Community Manager", "Chuyên viên giáo dục bảo tàng", "Chuyên viên xuất bản số"],
    skills: ["Storytelling", "Biên tập", "Digital production", "Audience engagement"],
    salaryMin: 8_500_000,
    salaryMax: 22_000_000,
    educationRequirement: "flexible",
    culture: ["creativity", "project_based"],
    postingGrowthRate: 8.6,
    salaryGrowthRate: 4.9,
  },
  {
    careerFamily: "Năng lượng và giao thông",
    industry: "Năng lượng và vận tải",
    roles: ["Kỹ sư năng lượng tái tạo", "Kỹ thuật viên điện mặt trời", "Chuyên viên vận hành điện gió", "Kỹ sư hệ thống điện", "Chuyên viên kiểm toán năng lượng", "Kỹ thuật viên dịch vụ xe điện", "Kỹ sư ô tô", "Chuyên viên điều hành giao thông", "Kỹ thuật viên đường sắt", "Điều phối khai thác hàng hải"],
    skills: ["Electrical systems", "Energy efficiency", "Technical maintenance", "Safety management"],
    salaryMin: 10_000_000,
    salaryMax: 26_000_000,
    educationRequirement: "college",
    culture: ["fieldwork", "hands_on"],
    postingGrowthRate: 12.7,
    salaryGrowthRate: 6.2,
  },
  {
    careerFamily: "Nhân sự, xã hội và thể thao",
    industry: "Dịch vụ con người và cộng đồng",
    roles: ["Nhân viên công tác xã hội", "Điều phối dự án cộng đồng", "Điều phối viên NGO", "Chuyên viên tuyển dụng", "Chuyên viên vận hành nhân sự", "Chuyên viên đào tạo và phát triển", "Huấn luyện viên thể thao", "Chuyên viên quản lý thể thao", "Huấn luyện viên thể hình", "Chuyên viên an toàn sức khỏe nghề nghiệp"],
    skills: ["People communication", "Program coordination", "Coaching", "Case documentation"],
    salaryMin: 8_000_000,
    salaryMax: 21_000_000,
    educationRequirement: "flexible",
    culture: ["team_based", "fieldwork"],
    postingGrowthRate: 8.1,
    salaryGrowthRate: 4.7,
  },
] satisfies readonly CareerFamilyTemplate[];

export const MARKET_ROLE_COUNT_PER_REGION = CAREER_FAMILIES.reduce(
  (total, family) => total + family.roles.length,
  0,
);
export const MARKET_INDUSTRY_COUNT = CAREER_FAMILIES.length;

const SOURCE_TIMESTAMP = "2026-07-18T00:00:00Z";
const EXPERIENCE_LEVELS = ["intern", "fresher", "junior", "mid", "senior"] as const;
const HIGH_MARKET_REGIONS = new Set(["Thành phố Hà Nội", "Thành phố Hồ Chí Minh"]);
const REGIONAL_HUBS = new Set([
  "Thành phố Hải Phòng",
  "Thành phố Huế",
  "Thành phố Đà Nẵng",
  "Thành phố Cần Thơ",
  "Tỉnh Bắc Ninh",
  "Tỉnh Quảng Ninh",
  "Tỉnh Đồng Nai",
]);

function salaryFactor(region: string): number {
  if (HIGH_MARKET_REGIONS.has(region)) return 1.18;
  if (REGIONAL_HUBS.has(region)) return 1.06;
  return 0.92;
}

function roundSalary(value: number): number {
  return Math.round(value / 250_000) * 250_000;
}

function createPostings(regions: readonly string[]): Posting[] {
  return regions.flatMap((region, regionIndex) =>
    CAREER_FAMILIES.flatMap((family, familyIndex) =>
      family.roles.map((jobTitle, roleIndex) => {
        const factor = salaryFactor(region) * (1 + (roleIndex % 4) * 0.025);
        const skillOffset = roleIndex % family.skills.length;
        const requiredSkills = Array.from({ length: 3 }, (_, skillIndex) => {
          const skillName = family.skills[(skillOffset + skillIndex) % family.skills.length];
          return {
            skill_name: skillName,
            importance: (5 - Math.min(skillIndex, 2)) as 3 | 4 | 5,
            is_short_supply: skillIndex === 0 && (familyIndex + roleIndex) % 3 !== 0,
            is_proprietary: false,
          };
        });
        const day = 1 + ((regionIndex * 7 + familyIndex * 3 + roleIndex) % 18);

        return {
          job_id: `seed-${String(regionIndex + 1).padStart(2, "0")}-${String(familyIndex + 1).padStart(2, "0")}-${String(roleIndex + 1).padStart(2, "0")}`,
          job_title: jobTitle,
          industry: family.industry,
          region,
          avg_salary: {
            min: roundSalary(family.salaryMin * factor),
            max: roundSalary(family.salaryMax * factor),
            currency: "VND" as const,
            period: "month" as const,
          },
          required_skills: requiredSkills,
          experience_level: EXPERIENCE_LEVELS[(familyIndex + roleIndex) % EXPERIENCE_LEVELS.length],
          education_requirement: family.educationRequirement,
          culture_fit_indicators: [...family.culture],
          posted_at: `2026-07-${String(day).padStart(2, "0")}T00:00:00Z`,
        };
      }),
    ),
  );
}

function createTrendSummary(regions: readonly string[]): LaborMarketSignals["trend_summary"] {
  return regions.flatMap((region, regionIndex) =>
    Array.from({ length: 5 }, (_, trendIndex) => {
      const family = CAREER_FAMILIES[(regionIndex * 3 + trendIndex * 4) % CAREER_FAMILIES.length];
      return {
        career_family: family.careerFamily,
        region,
        posting_growth_rate: Number((family.postingGrowthRate * salaryFactor(region)).toFixed(1)),
        salary_growth_rate: Number((family.salaryGrowthRate * Math.min(salaryFactor(region), 1.1)).toFixed(1)),
        short_supply_skills: family.skills.slice(0, 2),
        confidence: 0.62 + ((regionIndex + trendIndex) % 4) * 0.07,
      };
    }),
  );
}

/**
 * Dữ liệu POC được sinh xác định: 200 nghề thuộc 20 nhóm ngành cho mỗi
 * tỉnh/thành. Đây không phải tin tuyển dụng thật và cần được thay bằng nguồn
 * thị trường đã kiểm chứng khi vận hành production.
 */
export function createCareerLensMarketSeed(regions: readonly string[]): LaborMarketSignals {
  return {
    source_timestamp: SOURCE_TIMESTAMP,
    postings: createPostings(regions),
    trend_summary: createTrendSummary(regions),
  };
}

export const CAREERLENS_MARKET_SEED = createCareerLensMarketSeed(VIETNAM_PROVINCES);

export async function getCareerLensMarketSeed(): Promise<LaborMarketSignals> {
  return createCareerLensMarketSeed(await getVietnamProvinceNames());
}

function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi");
}

function relevanceScore(posting: Posting, keywords: string[]): number {
  const title = normalizeSearchText(posting.job_title);
  const industry = normalizeSearchText(posting.industry);
  const skills = normalizeSearchText(
    posting.required_skills.map((skill) => skill.skill_name).join(" "),
  );

  return keywords.reduce((score, keyword) => {
    const normalizedKeyword = normalizeSearchText(keyword).trim();
    if (!normalizedKeyword) return score;

    const tokens = normalizedKeyword.split(/\s+/).filter((token) => token.length >= 2);
    const titleMatch = title.includes(normalizedKeyword) ? 12 : 0;
    const tokenScore = tokens.reduce(
      (total, token) =>
        total + (title.includes(token) ? 5 : 0) + (industry.includes(token) ? 3 : 0) + (skills.includes(token) ? 2 : 0),
      0,
    );
    return score + titleMatch + tokenScore;
  }, 0);
}

export function selectCareerLensMarketSignals({
  currentRegion,
  targetRegions,
  keywords,
  marketSeed = CAREERLENS_MARKET_SEED,
}: {
  currentRegion: string;
  targetRegions: string[];
  keywords: string[];
  marketSeed?: LaborMarketSignals;
}): LaborMarketSignals {
  const regions = [...new Set([...targetRegions, currentRegion].filter(Boolean))];
  const selectedPostings = regions.flatMap((region) => {
    const regionPostings = marketSeed.postings.filter(
      (posting) => posting.region === region,
    );
    const byIndustry = new Map<string, Posting[]>();

    for (const posting of regionPostings) {
      const group = byIndustry.get(posting.industry) ?? [];
      group.push(posting);
      byIndustry.set(posting.industry, group);
    }

    return [...byIndustry.values()]
      .map((group) =>
        group.toSorted(
          (left, right) =>
            relevanceScore(right, keywords) - relevanceScore(left, keywords) ||
            left.job_id.localeCompare(right.job_id),
        )[0],
      )
      .toSorted(
        (left, right) =>
          relevanceScore(right, keywords) - relevanceScore(left, keywords) ||
          left.job_id.localeCompare(right.job_id),
      );
  });

  return {
    source_timestamp: marketSeed.source_timestamp,
    postings: selectedPostings,
    trend_summary: regions.flatMap((region) =>
      marketSeed.trend_summary.filter((trend) => trend.region === region),
    ),
  };
}
