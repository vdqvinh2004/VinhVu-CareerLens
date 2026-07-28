"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

type BrandLinkProps = {
  className?: string;
  compact?: boolean;
  credit?: boolean;
  markClassName?: string;
};

type BrandMarkProps = {
  className?: string;
};

function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "relative block h-7 w-12 shrink-0 drop-shadow-[0_3px_6px_rgb(0_0_0_/_0.45)] dark:drop-shadow-[0_3px_7px_rgb(128_128_128_/_0.3)]",
        className,
      )}
    >
      <span className="absolute inset-0 overflow-hidden">
        <Image
          src="/logo-nolabel.svg"
          alt=""
          width={686}
          height={686}
          loading="eager"
          className="absolute left-0 top-1/2 h-auto w-full -translate-y-1/2"
        />
      </span>
    </span>
  );
}

function BrandLink({
  className,
  compact = false,
  credit = true,
  markClassName,
}: BrandLinkProps) {
  const t = useTranslations("Common");

  return (
    <Link
      href="/"
      aria-label={t("homeAria")}
      className={cn(
        "inline-flex min-h-10 min-w-10 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
        className,
      )}
    >
      <BrandMark className={cn(compact && "h-6 w-10", markClassName)} />
      {!compact && (
        <span className="min-w-0 leading-none">
          <span className="block truncate text-sm font-semibold tracking-tight">
            {t("brandName")}
          </span>
          {credit && (
            <span className="mt-1 block truncate text-[0.625rem] font-medium tracking-wide text-muted-foreground">
              {t("developedBy")}
            </span>
          )}
        </span>
      )}
    </Link>
  );
}

export { BrandLink, BrandMark };
