"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AdminAlert,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { adminFetch } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Settings = {
  site_name: string | null;
  tagline: string | null;
  support_email: string | null;
  support_phone: string | null;
  whatsapp_number: string | null;
  currency: string | null;
  free_shipping_min: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

export default function AdminSettingsPage() {
  const { data, error, loading, reload } = useAdminQuery<Settings>("/api/admin/settings");
  const [form, setForm] = useState<Settings>({
    site_name: "",
    tagline: "",
    support_email: "",
    support_phone: "",
    whatsapp_number: "",
    currency: "INR",
    free_shipping_min: "0",
    seo_title: "",
    seo_description: ""
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!data) return;
    setForm({
      site_name: data.site_name || "",
      tagline: data.tagline || "",
      support_email: data.support_email || "",
      support_phone: data.support_phone || "",
      whatsapp_number: data.whatsapp_number || "",
      currency: data.currency || "INR",
      free_shipping_min: data.free_shipping_min ?? "0",
      seo_title: data.seo_title || "",
      seo_description: data.seo_description || ""
    });
  }, [data]);

  const onSave = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSaveError("");
    const result = await adminFetch("/api/admin/settings", {
      method: "PATCH",
      json: {
        ...form,
        free_shipping_min: Number(form.free_shipping_min || 0)
      }
    });
    setSaving(false);
    if (result.error) setSaveError(result.error);
    else {
      setMessage("Settings saved.");
      await reload();
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Settings"
        description="Business profile, support channels and storefront SEO."
      />

      <AdminPanel title="Site settings">
        {loading && <AdminLoading />}
        {error && <AdminAlert>{error}</AdminAlert>}
        {!loading && !error && (
          <form className="admin-form-grid" onSubmit={onSave}>
            <label>
              <span>Site name</span>
              <input
                value={form.site_name || ""}
                onChange={(e) => setForm((f) => ({ ...f, site_name: e.target.value }))}
              />
            </label>
            <label>
              <span>Tagline</span>
              <input
                value={form.tagline || ""}
                onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
              />
            </label>
            <label>
              <span>Support email</span>
              <input
                type="email"
                value={form.support_email || ""}
                onChange={(e) => setForm((f) => ({ ...f, support_email: e.target.value }))}
              />
            </label>
            <label>
              <span>Support phone</span>
              <input
                value={form.support_phone || ""}
                onChange={(e) => setForm((f) => ({ ...f, support_phone: e.target.value }))}
              />
            </label>
            <label>
              <span>WhatsApp</span>
              <input
                value={form.whatsapp_number || ""}
                onChange={(e) => setForm((f) => ({ ...f, whatsapp_number: e.target.value }))}
              />
            </label>
            <label>
              <span>Currency</span>
              <input
                value={form.currency || ""}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              />
            </label>
            <label>
              <span>Free shipping min</span>
              <input
                type="number"
                min="0"
                value={form.free_shipping_min || ""}
                onChange={(e) => setForm((f) => ({ ...f, free_shipping_min: e.target.value }))}
              />
            </label>
            <label>
              <span>SEO title</span>
              <input
                value={form.seo_title || ""}
                onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
              />
            </label>
            <label className="admin-span-2">
              <span>SEO description</span>
              <textarea
                rows={3}
                value={form.seo_description || ""}
                onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
              />
            </label>
            {saveError && <AdminAlert>{saveError}</AdminAlert>}
            {message && <AdminAlert tone="ok">{message}</AdminAlert>}
            <div className="admin-span-2">
              <button className="btn" type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save settings"}
              </button>
            </div>
          </form>
        )}
      </AdminPanel>
    </>
  );
}
