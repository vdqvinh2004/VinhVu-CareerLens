"use client";
import { useTranslations } from "next-intl";
export default function DashboardMenuPage() {
  const t = useTranslations("Dashboard");
  return <h1 className="p-8 text-2xl font-semibold">{t("menuHeading")}</h1>;
}
