import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../lib/auth/api";
import { query, queryOne } from "../../../../lib/db/pool";
import {
  listIntegrations,
  sanitizeIntegrationConfig,
  type IntegrationChannel
} from "../../../../lib/integrations";

const CHANNELS: IntegrationChannel[] = ["whatsapp", "sms", "email"];

function isChannel(value: unknown): value is IntegrationChannel {
  return typeof value === "string" && CHANNELS.includes(value as IntegrationChannel);
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

const SECRET_KEYS: Record<IntegrationChannel, string[]> = {
  whatsapp: [],
  sms: ["authToken"],
  email: ["pass"]
};

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;

  try {
    const rows = await listIntegrations();
    return ok(
      rows.map((row) => ({
        ...row,
        config: sanitizeIntegrationConfig(row.channel, row.config)
      }))
    );
  } catch (err) {
    console.error("[admin/integrations]", err);
    return fail(
      "Integrations table missing. Run: npm run db:patch:integrations",
      503
    );
  }
}

export async function PATCH(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  const body = (await request.json().catch(() => null)) as {
    channel?: unknown;
    is_enabled?: unknown;
    config?: unknown;
  } | null;

  if (!body || !isChannel(body.channel)) {
    return fail("channel must be whatsapp, sms, or email");
  }

  const channel = body.channel;
  const existing = await queryOne<{
    id: string;
    is_enabled: boolean;
    config: unknown;
  }>(`select id, is_enabled, config from integration_settings where channel = $1`, [channel]);

  if (!existing) {
    return fail("Integration row missing. Run: npm run db:patch:integrations", 404);
  }

  const prevConfig = asObject(existing.config);
  const nextConfig = { ...prevConfig };

  if (body.config && typeof body.config === "object" && !Array.isArray(body.config)) {
    const incoming = body.config as Record<string, unknown>;
    for (const [key, value] of Object.entries(incoming)) {
      if (SECRET_KEYS[channel].includes(key)) {
        const str = typeof value === "string" ? value : "";
        if (!str || str.includes("•")) continue; // keep existing secret
      }
      nextConfig[key] = value;
    }
  }

  const isEnabled =
    typeof body.is_enabled === "boolean" ? body.is_enabled : existing.is_enabled;

  const [updated] = await query<{
    id: string;
    channel: IntegrationChannel;
    is_enabled: boolean;
    config: unknown;
    updated_at: string;
  }>(
    `update integration_settings
     set is_enabled = $1,
         config = $2::jsonb,
         updated_at = now()
     where channel = $3
     returning id, channel, is_enabled, config, updated_at`,
    [isEnabled, JSON.stringify(nextConfig), channel]
  );

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "integration_settings",
    entityId: updated.id,
    after: {
      channel: updated.channel,
      is_enabled: updated.is_enabled,
      config: sanitizeIntegrationConfig(updated.channel, asObject(updated.config))
    }
  });

  return ok({
    ...updated,
    config: sanitizeIntegrationConfig(updated.channel, asObject(updated.config))
  });
}
