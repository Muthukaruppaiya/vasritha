"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  AdminAlert,
  AdminBadge,
  AdminEmpty,
  AdminLoading,
  AdminPageHeader,
  AdminPanel
} from "../../../components/admin/admin-ui";
import { adminFetch } from "../../../lib/admin-api";
import { useAdminQuery } from "../../../hooks/use-admin-query";

type Channel = "whatsapp" | "sms" | "email";

type IntegrationRow = {
  id: string;
  channel: Channel;
  is_enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
};

const CHANNEL_META: Record<
  Channel,
  { title: string; blurb: string; fields: { key: string; label: string; type?: string; hint?: string }[] }
> = {
  whatsapp: {
    title: "WhatsApp",
    blurb: "Storefront chat button and wa.me links. Off until you enable it.",
    fields: [
      { key: "phoneNumber", label: "WhatsApp number (with country code)", hint: "e.g. 919876543210" },
      { key: "prefillMessage", label: "Default message" },
      { key: "showFloat", label: "Show floating chat button", type: "checkbox" }
    ]
  },
  sms: {
    title: "SMS",
    blurb: "Transactional SMS (Twilio). Off until you enable it and add credentials.",
    fields: [
      { key: "provider", label: "Provider", hint: "twilio" },
      { key: "accountSid", label: "Account SID" },
      { key: "authToken", label: "Auth token", type: "password" },
      { key: "fromNumber", label: "From number", hint: "e.g. +1…" },
      { key: "senderId", label: "Sender ID (optional)" }
    ]
  },
  email: {
    title: "Email (SMTP)",
    blurb: "Order/review notifications via SMTP. Off until you enable it.",
    fields: [
      { key: "host", label: "SMTP host" },
      { key: "port", label: "Port", type: "number", hint: "587 or 465" },
      { key: "user", label: "Username" },
      { key: "pass", label: "Password", type: "password" },
      { key: "from", label: "From address" }
    ]
  }
};

export default function AdminIntegrationsPage() {
  const { data, error, loading, reload } = useAdminQuery<IntegrationRow[]>("/api/admin/integrations");
  const [tab, setTab] = useState<Channel>("whatsapp");
  const [form, setForm] = useState<Record<string, string | boolean>>({});
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const byChannel = useMemo(() => {
    const map = new Map<Channel, IntegrationRow>();
    for (const row of data || []) map.set(row.channel, row);
    return map;
  }, [data]);

  useEffect(() => {
    const row = byChannel.get(tab);
    if (!row) {
      setForm({});
      setEnabled(false);
      return;
    }
    setEnabled(row.is_enabled);
    const next: Record<string, string | boolean> = {};
    for (const field of CHANNEL_META[tab].fields) {
      const raw = row.config[field.key];
      if (field.type === "checkbox") {
        next[field.key] = raw !== false;
      } else if (field.type === "number") {
        next[field.key] = raw == null ? "" : String(raw);
      } else {
        next[field.key] = raw == null ? "" : String(raw);
      }
    }
    setForm(next);
  }, [tab, byChannel]);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setSaveError("");
    try {
      const config: Record<string, unknown> = {};
      for (const field of CHANNEL_META[tab].fields) {
        const value = form[field.key];
        if (field.type === "checkbox") {
          config[field.key] = Boolean(value);
        } else if (field.type === "number") {
          config[field.key] = value === "" ? null : Number(value);
        } else {
          config[field.key] = value;
        }
      }
      const result = await adminFetch("/api/admin/integrations", {
        method: "PATCH",
        json: { channel: tab, is_enabled: enabled, config }
      });
      if (result.error) {
        setSaveError(result.error);
        return;
      }
      setMessage(`${CHANNEL_META[tab].title} saved.`);
      await reload();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-stack">
      <AdminPageHeader
        title="Integrations"
        description="Enable WhatsApp, SMS, or Email when you are ready. All channels start disabled."
      />

      {error ? <AdminAlert tone="danger">{error}</AdminAlert> : null}
      {message ? <AdminAlert tone="success">{message}</AdminAlert> : null}
      {saveError ? <AdminAlert tone="danger">{saveError}</AdminAlert> : null}

      <div className="admin-tabs" role="tablist">
        {(Object.keys(CHANNEL_META) as Channel[]).map((channel) => {
          const row = byChannel.get(channel);
          return (
            <button
              key={channel}
              type="button"
              role="tab"
              className={tab === channel ? "is-active" : ""}
              onClick={() => setTab(channel)}
            >
              {CHANNEL_META[channel].title}
              {row ? (
                <AdminBadge tone={row.is_enabled ? "success" : "neutral"}>
                  {row.is_enabled ? "On" : "Off"}
                </AdminBadge>
              ) : null}
            </button>
          );
        })}
      </div>

      {loading && !data ? (
        <AdminLoading />
      ) : !byChannel.get(tab) ? (
        <AdminEmpty
          title="Integrations not installed"
          description="Run npm run db:patch:integrations, then refresh."
        />
      ) : (
        <AdminPanel title={CHANNEL_META[tab].title} description={CHANNEL_META[tab].blurb}>
          <form className="admin-form" onSubmit={onSave}>
            <label className="admin-check-row">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <span>Enable {CHANNEL_META[tab].title}</span>
            </label>

            {CHANNEL_META[tab].fields.map((field) => {
              if (field.type === "checkbox") {
                return (
                  <label key={field.key} className="admin-check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(form[field.key])}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [field.key]: e.target.checked }))
                      }
                    />
                    <span>{field.label}</span>
                  </label>
                );
              }
              return (
                <label key={field.key}>
                  <span>{field.label}</span>
                  <input
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                    value={String(form[field.key] ?? "")}
                    placeholder={field.hint}
                    onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                    autoComplete={field.type === "password" ? "new-password" : "off"}
                  />
                  {field.hint && field.type !== "password" ? (
                    <span className="admin-field-hint">{field.hint}</span>
                  ) : null}
                </label>
              );
            })}

            <div>
              <button type="submit" className="btn" disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </AdminPanel>
      )}
    </div>
  );
}
