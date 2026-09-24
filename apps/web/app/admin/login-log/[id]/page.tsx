"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  AdminAlert,
  AdminBadge,
  AdminLoading,
  AdminPageHeader,
  AdminPanel,
  statusTone
} from "../../../../components/admin/admin-ui";
import { formatDate } from "../../../../lib/admin-api";
import { useAdminQuery } from "../../../../hooks/use-admin-query";
import { OPS_PLATFORM_NAME } from "../../../../lib/platform";

type LoginEventDetail = {
  id: string;
  user_id: string | null;
  email_attempted: string;
  success: boolean;
  failure_code: string | null;
  failure_message: string | null;
  client: string;
  ip: string | null;
  user_agent: string | null;
  device_key: string | null;
  device_label: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  roles_snapshot: string[] | null;
  created_at: string;
  full_name: string | null;
  user_email: string | null;
  user_phone: string | null;
};

function rolesLabel(roles: string[] | string | null) {
  if (!roles) return "—";
  if (typeof roles === "string") {
    try {
      const parsed = JSON.parse(roles) as string[];
      return parsed.length ? parsed.join(", ") : "—";
    } catch {
      return roles;
    }
  }
  if (!roles.length) return "—";
  return roles.join(", ");
}

export default function LoginLogDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { data, error, loading } = useAdminQuery<LoginEventDetail>(
    id ? `/api/admin/login-log/${id}` : ""
  );

  return (
    <div className="admin-stack">
      <AdminPageHeader
        eyebrow={OPS_PLATFORM_NAME}
        title="Login event"
        description="Full detail for a single sign-in attempt."
        actions={
          <Link className="btn ghost" href="/admin/login-log">
            <ArrowLeft size={15} />
            Back to log
          </Link>
        }
      />

      {error ? <AdminAlert>{error}</AdminAlert> : null}
      {loading ? <AdminLoading /> : null}

      {data ? (
        <>
          <div className="admin-card-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
            <AdminPanel title="Result">
              <AdminBadge tone={data.success ? "success" : statusTone("cancelled")}>
                {data.success ? "success" : data.failure_code || "failed"}
              </AdminBadge>
            </AdminPanel>
            <AdminPanel title="When">
              <p style={{ margin: 0 }}>
                <b>{formatDate(data.created_at)}</b>
              </p>
            </AdminPanel>
            <AdminPanel title="Client">
              <p style={{ margin: 0 }}>
                <b>{data.client}</b>
              </p>
            </AdminPanel>
            <AdminPanel title="IP">
              <p style={{ margin: 0 }}>
                <b>{data.ip || "—"}</b>
              </p>
            </AdminPanel>
          </div>

          <AdminPanel title="User">
            <dl className="admin-detail-grid">
              <div>
                <dt>Name</dt>
                <dd>{data.full_name || "—"}</dd>
              </div>
              <div>
                <dt>Account email</dt>
                <dd>{data.user_email || "—"}</dd>
              </div>
              <div>
                <dt>Email attempted</dt>
                <dd>{data.email_attempted}</dd>
              </div>
              <div>
                <dt>Phone</dt>
                <dd>{data.user_phone || "—"}</dd>
              </div>
              <div>
                <dt>User ID</dt>
                <dd>
                  <code>{data.user_id || "—"}</code>
                </dd>
              </div>
              <div>
                <dt>Roles at login</dt>
                <dd>{rolesLabel(data.roles_snapshot)}</dd>
              </div>
            </dl>
          </AdminPanel>

          <AdminPanel title="Device &amp; location">
            <dl className="admin-detail-grid">
              <div>
                <dt>Device label</dt>
                <dd>{data.device_label || "—"}</dd>
              </div>
              <div>
                <dt>Device key</dt>
                <dd>
                  <code>{data.device_key || "—"}</code>
                </dd>
              </div>
              <div className="admin-span-2">
                <dt>User agent</dt>
                <dd style={{ wordBreak: "break-word" }}>{data.user_agent || "—"}</dd>
              </div>
              <div>
                <dt>Latitude</dt>
                <dd>{data.latitude != null ? String(data.latitude) : "—"}</dd>
              </div>
              <div>
                <dt>Longitude</dt>
                <dd>{data.longitude != null ? String(data.longitude) : "—"}</dd>
              </div>
            </dl>
          </AdminPanel>

          {!data.success ? (
            <AdminPanel title="Failure">
              <dl className="admin-detail-grid">
                <div>
                  <dt>Code</dt>
                  <dd>
                    <code>{data.failure_code || "—"}</code>
                  </dd>
                </div>
                <div className="admin-span-2">
                  <dt>Message</dt>
                  <dd>{data.failure_message || "—"}</dd>
                </div>
              </dl>
            </AdminPanel>
          ) : null}

          <AdminPanel title="Event ID">
            <code>{data.id}</code>
          </AdminPanel>
        </>
      ) : null}
    </div>
  );
}
