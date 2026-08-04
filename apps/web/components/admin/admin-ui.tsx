"use client";

import { ReactNode } from "react";

export function AdminPageHeader({
  eyebrow = "Admin workspace",
  title,
  description,
  actions
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="admin-page-head">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {description ? <p className="muted admin-page-desc">{description}</p> : null}
      </div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}

export function AdminPanel({
  title,
  children,
  actions,
  className = ""
}: {
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`admin-panel ${className}`.trim()}>
      {(title || actions) && (
        <div className="admin-panel-head">
          {title ? <h3>{title}</h3> : <span />}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function AdminBadge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warn" | "danger" | "info";
}) {
  return <span className={`admin-badge admin-badge--${tone}`}>{children}</span>;
}

export function statusTone(status?: string | null): "neutral" | "success" | "warn" | "danger" | "info" {
  const value = (status || "").toLowerCase();
  if (["paid", "active", "delivered", "approved", "published", "confirmed"].includes(value)) {
    return "success";
  }
  if (["pending", "processing", "draft", "requested", "shipped"].includes(value)) return "warn";
  if (["failed", "cancelled", "rejected", "archived", "refunded"].includes(value)) return "danger";
  if (["received"].includes(value)) return "info";
  return "neutral";
}

export function AdminEmpty({ title, body }: { title: string; body?: string }) {
  return (
    <div className="admin-empty">
      <strong>{title}</strong>
      {body ? <p className="muted">{body}</p> : null}
    </div>
  );
}

export function AdminAlert({ children, tone = "error" }: { children: ReactNode; tone?: "error" | "ok" }) {
  return <p className={`admin-alert admin-alert--${tone}`}>{children}</p>;
}

export function AdminLoading() {
  return <div className="admin-inline-loading">Loading…</div>;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
