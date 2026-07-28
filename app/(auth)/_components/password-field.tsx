"use client";

import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type PasswordFieldProps = Omit<ComponentProps<typeof Input>, "type"> & {
  label: string;
  labelAction?: ReactNode;
};

function PasswordField({
  id,
  label,
  labelAction,
  className,
  ...props
}: PasswordFieldProps) {
  const t = useTranslations("Auth.common");
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={inputId}>{label}</Label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={inputId}
          type={isVisible ? "text" : "password"}
          className={cn("pr-12", className)}
          placeholder="********"
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          pressAnimation={false}
          aria-label={t(isVisible ? "hideField" : "showField", {
            field: label.toLocaleLowerCase(),
          })}
          aria-controls={inputId}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((visible) => !visible)}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground">
          <span
            aria-hidden="true"
            className="flex size-4 items-center justify-center">
            {isVisible ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </span>
        </Button>
      </div>
    </div>
  );
}

export { PasswordField };
