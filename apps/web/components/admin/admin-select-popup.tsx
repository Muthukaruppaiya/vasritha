"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";

export type AdminSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  label?: string;
  value: string;
  options: AdminSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  title?: string;
  className?: string;
};

export function AdminSelectPopup({
  label,
  value,
  options,
  onChange,
  placeholder = "Select…",
  disabled = false,
  required = false,
  title,
  className = ""
}: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const popupTitle = title || label || "Choose option";

  const selected = useMemo(
    () => options.find((opt) => opt.value === value) || null,
    [options, value]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const popup =
    open && mounted
      ? createPortal(
          <div
            className="admin-select-popup-backdrop"
            role="presentation"
            onClick={() => setOpen(false)}
          >
            <div
              className="admin-select-popup"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="admin-select-popup-head">
                <h3 id={titleId}>{popupTitle}</h3>
                <button
                  type="button"
                  className="admin-icon-tip"
                  onClick={() => setOpen(false)}
                  data-tooltip="Close"
                  aria-label="Close"
                >
                  <X size={16} strokeWidth={2} />
                  <span>Close</span>
                </button>
              </div>
              <div className="admin-select-popup-list" role="listbox" aria-labelledby={titleId}>
                {options.map((opt) => {
                  const isActive = opt.value === value;
                  return (
                    <button
                      key={opt.value || "__empty__"}
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      disabled={opt.disabled}
                      className={`admin-select-popup-option${isActive ? " is-active" : ""}`}
                      onClick={() => {
                        if (opt.disabled) return;
                        onChange(opt.value);
                        setOpen(false);
                      }}
                    >
                      <span>{opt.label}</span>
                      {isActive ? <Check size={16} strokeWidth={2.2} aria-hidden /> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  const field = (
    <>
      <button
        type="button"
        className={`admin-select-trigger${disabled ? " is-disabled" : ""}${!selected ? " is-placeholder" : ""}`}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={() => {
          if (!disabled) setOpen(true);
        }}
      >
        <span>{selected?.label || placeholder}</span>
        <ChevronDown size={16} strokeWidth={2} aria-hidden />
      </button>
      {popup}
    </>
  );

  return (
    <div className={`admin-select-field ${className}`.trim()}>
      {label ? <span className="admin-select-field-label">{label}</span> : null}
      {field}
    </div>
  );
}
