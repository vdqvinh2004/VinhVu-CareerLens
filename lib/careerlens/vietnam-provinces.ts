/**
 * Danh mục đơn vị hành chính cấp tỉnh theo Quyết định 19/2025/QĐ-TTg,
 * có hiệu lực từ ngày 01/07/2025. Dùng làm fallback khi API tỉnh/thành lỗi.
 */
export const VIETNAM_PROVINCES = [
  "Thành phố Hà Nội",
  "Tỉnh Cao Bằng",
  "Tỉnh Tuyên Quang",
  "Tỉnh Điện Biên",
  "Tỉnh Lai Châu",
  "Tỉnh Sơn La",
  "Tỉnh Lào Cai",
  "Tỉnh Thái Nguyên",
  "Tỉnh Lạng Sơn",
  "Tỉnh Quảng Ninh",
  "Tỉnh Bắc Ninh",
  "Tỉnh Phú Thọ",
  "Thành phố Hải Phòng",
  "Tỉnh Hưng Yên",
  "Tỉnh Ninh Bình",
  "Tỉnh Thanh Hóa",
  "Tỉnh Nghệ An",
  "Tỉnh Hà Tĩnh",
  "Tỉnh Quảng Trị",
  "Thành phố Huế",
  "Thành phố Đà Nẵng",
  "Tỉnh Quảng Ngãi",
  "Tỉnh Gia Lai",
  "Tỉnh Khánh Hòa",
  "Tỉnh Đắk Lắk",
  "Tỉnh Lâm Đồng",
  "Tỉnh Đồng Nai",
  "Thành phố Hồ Chí Minh",
  "Tỉnh Tây Ninh",
  "Tỉnh Đồng Tháp",
  "Tỉnh Vĩnh Long",
  "Tỉnh An Giang",
  "Thành phố Cần Thơ",
  "Tỉnh Cà Mau",
] as const;

export type VietnamProvince = string;

const VIETNAM_PROVINCES_API_URL = "https://provinces.open-api.vn/api/v2/";

type ProvinceApiItem = {
  name: string;
};

function isProvinceApiItem(value: unknown): value is ProvinceApiItem {
  return Boolean(
    value &&
      typeof value === "object" &&
      "name" in value &&
      typeof value.name === "string" &&
      value.name.trim(),
  );
}

export async function getVietnamProvinceNames(): Promise<string[]> {
  try {
    const response = await fetch(VIETNAM_PROVINCES_API_URL, {
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!response.ok) return [...VIETNAM_PROVINCES];

    const data: unknown = await response.json();
    if (!Array.isArray(data)) return [...VIETNAM_PROVINCES];

    const names = data.filter(isProvinceApiItem).map((province) => province.name.trim());
    return names.length > 0 ? [...new Set(names)] : [...VIETNAM_PROVINCES];
  } catch {
    return [...VIETNAM_PROVINCES];
  }
}
