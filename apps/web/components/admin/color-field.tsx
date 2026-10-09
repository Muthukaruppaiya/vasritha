"use client";

import { useMemo, useState } from "react";
import { useAdminQuery } from "../../hooks/use-admin-query";
import { adminFetch } from "../../lib/admin-api";

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
  /** Persist newly typed colour into master table on blur. */
  upsertOnBlur?: boolean;
};

export function ColorField({
  value,
  onChange,
  disabled,
  required,
  placeholder = "Colour",
  id = "colour-field",
  upsertOnBlur = true
}: Props) {
  const { data, reload } = useAdminQuery<{ colours: ColourRow[] }>("/api/admin/colours");
  const [busy, setBusy] = useState(false);
  const listId = `${id}-suggestions`;

  const colours = useMemo(() => data?.colours || [], [data?.colours]);

  const persistIfNew = async () => {
    const name = value.trim();
    if (!upsertOnBlur || !name || disabled || busy) return;
    const exists = colours.some((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return;
    setBusy(true);
    await adminFetch("/api/admin/colours", {
      method: "POST",
      json: { name }
    });
    setBusy(false);
    void reload();
  };

  return (
    <>
      <input
        id={id}
        list={listId}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => void persistIfNew()}
        autoComplete="off"
      />
      <datalist id={listId}>
        {colours.map((colour) => (
          <option key={colour.id} value={colour.name} />
        ))}
      </datalist>
    </>
  );
}
