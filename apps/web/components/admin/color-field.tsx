"use client";

import { useMemo } from "react";
import { useAdminQuery } from "../../hooks/use-admin-query";

type ColourRow = {
  id: string;
  name: string;
  hex: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  id?: string;
  /** Kept for call-site compatibility; colours now come from Settings → Colours. */
  upsertOnBlur?: boolean;
};

export function ColorField({
  value,
  onChange,
  disabled,
  required,
  placeholder = "Select colour",
  id = "colour-field"
}: Props) {
  const { data } = useAdminQuery<{ colours: ColourRow[] }>("/api/admin/colours");
  const colours = useMemo(() => data?.colours || [], [data?.colours]);
  const options = useMemo(() => {
    const list = [...colours];
    const current = value.trim();
    if (current && !list.some((c) => c.name.toLowerCase() === current.toLowerCase())) {
      list.unshift({ id: `current-${current}`, name: current, hex: null });
    }
    return list;
  }, [colours, value]);

  return (
    <select
      id={id}
      value={value}
      disabled={disabled}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map((colour) => (
        <option key={colour.id} value={colour.name}>
          {colour.name}
        </option>
      ))}
    </select>
  );
}
