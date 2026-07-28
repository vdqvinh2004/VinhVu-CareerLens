"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

type NavigationItem = {
  href: string;
  label: string;
};

type LandingMobileNavigationProps = {
  items: NavigationItem[];
  label: string;
};

function LandingMobileNavigation({ items, label }: LandingMobileNavigationProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="group relative md:hidden">
      <summary className="flex h-9 cursor-pointer list-none items-center rounded-full px-3 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/30 motion-reduce:transition-none [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown
          aria-hidden="true"
          className="ml-1 size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 grid min-w-44 gap-1 rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => detailsRef.current?.removeAttribute("open")}
            className="rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground motion-reduce:transition-none"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </details>
  );
}

export { LandingMobileNavigation };
