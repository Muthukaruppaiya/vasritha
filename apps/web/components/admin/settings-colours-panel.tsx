"use client";

import { FormEvent, useMemo, useState } from "react";
import { Ban, Check, Pencil, Plus } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPanel
} from "./admin-ui";
import { AdminFormModal } from "./admin-form-modal";
import { adminFetch } from "../../lib/admin-api";
import { useAdminQuery } from "../../hooks/use-admin-query";

type ColourRow = {
  id: string;
  name: string;
  hex: string | null;
  sort_order: number;
  is_active: boolean;
};

export function SettingsColoursPanel() {
  const { data, error, loading, reload } = useAdminQuery<{ colours: ColourRow[] }>(
    "/api/admin/colours?all=1"
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ColourRow | null>(null);
  const [name, setName] = useState("");
  const [hex, setHex] = useState("#D4AF37");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");

  const rows = useMemo(() => data?.colours || [], [data?.colours]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setHex("#D4AF37");
    setActionError("");
    setModalOpen(true);
  };

  const openEdit = (row: ColourRow) => {
    setEditing(row);
    setName(row.name);
    setHex(row.hex || "#D4AF37");
    setActionError("");
    setModalOpen(true);
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setActionError("Colour name is required");
      return;
    }
    setSaving(true);
    setActionError("");
    setMessage("");
    const payload = {
      name: trimmed,
      hex: hex.trim() || null,
      ...(editing ? { id: editing.id, is_active: true } : {})
    };
    const result = editing
      ? await adminFetch("/api/admin/colours", { method: "PATCH", json: payload })
      : await adminFetch("/api/admin/colours", { method: "POST", json: payload });
    setSaving(false);
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setModalOpen(false);
    setMessage(editing ? "Colour updated." : "Colour added. It is now available on the product form.");
    await reload();
  };

  const toggleActive = async (row: ColourRow) => {
    setActionError("");
    const result = await adminFetch("/api/admin/colours", {
      method: "PATCH",
      json: { id: row.id, is_active: !row.is_active }
    });
    if (result.error) {
      setActionError(result.error);
      return;
    }
    setMessage(row.is_active ? `${row.name} hidden from product colour list.` : `${row.name} shown on product colour list.`);
    await reload();
  };

  return (
    <>
      <AdminPanel
        title="Product colours"
        actions={
          <button
            type="button"
            className="admin-icon-tip admin-action-btn--primary"
            onClick={openCreate}
            data-tooltip="Add colour"
            aria-label="Add colour"
          >
            <Plus size={17} strokeWidth={2.2} />
            <span>Add colour</span>
          </button>
        }
      >
        <p className="muted" style={{ marginTop: 0 }}>
          Colours saved here appear in Product Master colour dropdown and Excel import.
        </p>
        {error && <AdminAlert>{error}</AdminAlert>}
        {actionError && <AdminAlert>{actionError}</AdminAlert>}
        {message && <AdminAlert tone="ok">{message}</AdminAlert>}
        {loading && <AdminLoading />}
        {!loading && !rows.length && (
          <AdminEmpty title="No colours yet" body="Add Gold, Maroon, and other product colours." />
        )}
        {!loading && rows.length > 0 && (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--zebra">
              <thead>
                <tr>
                  <th>Colour</th>
                  <th>Hex</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span
                        style={{
                          display: "inline-block",
                          width: 14,
                          height: 14,
                          borderRadius: 999,
                          marginRight: 8,
                          verticalAlign: "middle",
                          background: row.hex || "#d4c4b0",
                          border: "1px solid #c4b09a"
                        }}
                      />
                      <b>{row.name}</b>
                    </td>
                    <td>
                      <code>{row.hex || "—"}</code>
                    </td>
                    <td>
                      <AdminBadge tone={row.is_active ? "success" : "warn"}>
                        {row.is_active ? "Active" : "Hidden"}
                      </AdminBadge>
                    </td>
                    <td>
                      <div className="inv-row-actions">
                        <button type="button" className="admin-action-btn" onClick={() => openEdit(row)}>
                          <Pencil size={15} strokeWidth={2} />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          className="admin-action-btn"
                          onClick={() => void toggleActive(row)}
                        >
                          {row.is_active ? (
                            <Ban size={15} strokeWidth={2} />
                          ) : (
                            <Check size={15} strokeWidth={2} />
                          )}
                          <span>{row.is_active ? "Hide" : "Show"}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminPanel>

      <AdminFormModal
        open={modalOpen}
        title={editing ? "Edit colour" : "Add colour"}
        onClose={() => setModalOpen(false)}
        onSubmit={onSubmit}
        saving={saving}
        error={actionError}
      >
        <label>
          <span>Colour name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Gold"
          />
        </label>
        <label>
          <span>Swatch</span>
          <input type="color" value={hex} onChange={(e) => setHex(e.target.value)} />
        </label>
      </AdminFormModal>
    </>
  );
}
