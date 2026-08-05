"use client";

import { FormEvent, ReactNode } from "react";
import { X } from "lucide-react";

type AdminFormModalProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  onClose: () => void;
  onSubmit: (event: FormEvent) => void | Promise<void>;
  saving?: boolean;
  submitLabel?: string;
  savingLabel?: string;
  error?: string;
  children: ReactNode;
  wide?: boolean;
};

export function AdminFormModal({
  open,
  title,
  eyebrow = "Create new",
  onClose,
  onSubmit,
  saving = false,
  submitLabel = "Save",
  savingLabel = "Saving…",
  error = "",
  children,
  wide = false
}: AdminFormModalProps) {
  if (!open) return null;

  return (
    <div className="admin-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`admin-modal${wide ? " admin-modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-form-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="admin-modal-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id="admin-form-modal-title">{title}</h2>
          </div>
          <button type="button" className="admin-modal-close" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form
          className="admin-modal-body"
          onSubmit={(event) => {
            void onSubmit(event);
          }}
        >
          <div className="admin-form-grid">{children}</div>

          {error ? <p className="admin-alert admin-alert--error">{error}</p> : null}

          <div className="admin-modal-actions">
            <button type="button" className="admin-ghost-btn" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn" disabled={saving}>
              {saving ? savingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
