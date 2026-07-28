import type { ComponentProps } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <span className="relative block min-w-0 flex-1 [&>svg]:pointer-events-none [&>svg]:absolute [&>svg]:right-3 [&>svg]:top-1/2 [&>svg]:size-4 [&>svg]:-translate-y-1/2 [&>svg]:text-muted-foreground">
      <select
        data-slot="native-select"
        className={cn(
          "block h-11 w-full appearance-none rounded-lg border border-input bg-background py-0 pl-3 pr-10 text-sm shadow-xs outline-none transition-[border-color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15",
          className,
        )}
        {...props}
      />
      <ChevronDown aria-hidden="true" strokeWidth={1.75} />
    </span>
  );
}

export { NativeSelect };
