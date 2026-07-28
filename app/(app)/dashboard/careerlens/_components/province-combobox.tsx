"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

type ProvinceComboboxProps = {
  provinces: string[];
  id: string;
  name: string;
  defaultValue?: string;
  invalid?: boolean;
};

export function ProvinceCombobox({
  provinces,
  id,
  name,
  defaultValue,
  invalid = false,
}: ProvinceComboboxProps) {
  const t = useTranslations("Roadmap.form");
  const [value, setValue] = useState<string | null>(defaultValue ?? null);

  return (
    <>
      <Combobox
        items={provinces}
        value={value}
        onValueChange={setValue}
        autoHighlight
      >
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder={t("regionPlaceholder")}
          aria-invalid={invalid || undefined}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>{t("regionEmpty")}</ComboboxEmpty>
          <ComboboxList>
            {(province) => (
              <ComboboxItem key={province} value={province}>
                {province}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <input type="hidden" name={name} value={value ?? ""} />
    </>
  );
}
