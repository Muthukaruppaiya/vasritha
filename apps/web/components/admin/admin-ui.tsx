"use client";

import { ReactNode } from "react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

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
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
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

export function AdminTrend({ value }: { value: number }) {
  const isUp = value > 0;
  const isDown = value < 0;
  const tone = isUp ? "up" : isDown ? "down" : "flat";
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  return (
    <span className={`admin-trend admin-trend--${tone}`}>
      <Icon size={13} strokeWidth={2.4} />
      {Math.abs(value)}%
    </span>
  );
}

export function AdminSparkline({
  points,
  height = 68
}: {
  points: Array<{ label: string; total: number }>;
  height?: number;
}) {
  const max = Math.max(1, ...points.map((p) => p.total));
  return (
    <div className="admin-sparkline" style={{ height }}>
      {points.map((point) => {
        const pct = Math.max(4, Math.round((point.total / max) * 100));
        return (
          <div className="admin-sparkline-col" key={point.label + point.total}>
            <div className="admin-sparkline-bar-track">
              <div className="admin-sparkline-bar" style={{ height: `${pct}%` }} title={String(point.total)} />
            </div>
            <span className="admin-sparkline-label">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function AdminBarList({
  items,
  tone = "neutral"
}: {
  items: Array<{ label: string; value: number }>;
  tone?: "neutral" | "brand";
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="admin-barlist">
      {items.map((item) => (
        <div className="admin-barlist-row" key={item.label}>
          <span className="admin-barlist-label">{item.label}</span>
          <div className="admin-barlist-track">
            <div
              className={`admin-barlist-fill admin-barlist-fill--${tone}`}
              style={{ width: `${Math.max(3, Math.round((item.value / max) * 100))}%` }}
            />
          </div>
          <span className="admin-barlist-value">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
