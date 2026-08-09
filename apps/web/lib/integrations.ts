import { query, queryOne } from "./db/pool";

export type IntegrationChannel = "whatsapp" | "sms" | "email";

export type WhatsAppConfig = {
  phoneNumber?: string;
  showFloat?: boolean;
  prefillMessage?: string;
};

export type SmsConfig = {
  provider?: string;
  accountSid?: string;
  authToken?: string;
  fromNumber?: string;
  senderId?: string;
};

export type EmailConfig = {
  provider?: string;
  host?: string;
  port?: number;
  user?: string;
  pass?: string;
  from?: string;
};

export type IntegrationRow<T = Record<string, unknown>> = {
  id: string;
  channel: IntegrationChannel;
  is_enabled: boolean;
  config: T;
  updated_at: string;
};

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

export async function listIntegrations() {
  const rows = await query<{
    id: string;
    channel: IntegrationChannel;
    is_enabled: boolean;
    config: unknown;
    updated_at: string;
  }>(
    `select id, channel, is_enabled, config, updated_at
     from integration_settings
     order by channel asc`
  );

  return rows.map((row) => ({
    ...row,
    config: asObject(row.config)
  }));
}

export async function getIntegration<T = Record<string, unknown>>(channel: IntegrationChannel) {
  const row = await queryOne<{
    id: string;
    channel: IntegrationChannel;
    is_enabled: boolean;
    config: unknown;
    updated_at: string;
  }>(
    `select id, channel, is_enabled, config, updated_at
     from integration_settings
     where channel = $1`,
    [channel]
  );

  if (!row) return null;
  return {
    ...row,
    config: asObject(row.config) as T
  };
}

export async function isIntegrationEnabled(channel: IntegrationChannel) {
  const row = await getIntegration(channel);
  return Boolean(row?.is_enabled);
}

/** Public WhatsApp widget settings (no secrets). */
export async function getPublicWhatsApp() {
  const row = await getIntegration<WhatsAppConfig>("whatsapp");
  if (!row?.is_enabled) {
    return { enabled: false as const, phoneNumber: null, showFloat: false, prefillMessage: null };
  }
  const phone =
    String(row.config.phoneNumber || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "").replace(
      /\D/g,
      ""
    ) || null;
  return {
    enabled: true as const,
    phoneNumber: phone,
    showFloat: row.config.showFloat !== false,
    prefillMessage: String(row.config.prefillMessage || "")
  };
}

export async function sendSms(input: {
  to: string;
  body: string;
}): Promise<{ sent: boolean; skipped?: string }> {
  const row = await getIntegration<SmsConfig>("sms");
  if (!row?.is_enabled) {
    console.info("[sms:skipped]", { to: input.to, reason: "SMS integration disabled" });
    return { sent: false, skipped: "SMS integration disabled" };
  }

  const config = row.config;
  const provider = (config.provider || "twilio").toLowerCase();
  const to = input.to.replace(/\D/g, "");
  if (!to) return { sent: false, skipped: "Invalid phone number" };

  if (provider === "twilio") {
    const sid = config.accountSid || process.env.TWILIO_ACCOUNT_SID || "";
    const token = config.authToken || process.env.TWILIO_AUTH_TOKEN || "";
    const from = config.fromNumber || process.env.TWILIO_FROM_NUMBER || "";
    if (!sid || !token || !from) {
      console.info("[sms:skipped]", { to, reason: "Twilio credentials missing" });
      return { sent: false, skipped: "Twilio credentials missing" };
    }

    try {
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const body = new URLSearchParams({
        To: to.startsWith("+") ? to : `+${to}`,
        From: from,
        Body: input.body
      });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body
      });
      if (!res.ok) {
        const text = await res.text();
        console.error("[sms:error]", text);
        return { sent: false, skipped: "Twilio send failed" };
      }
      return { sent: true };
    } catch (error) {
      console.error("[sms:error]", error);
      return { sent: false, skipped: error instanceof Error ? error.message : "send failed" };
    }
  }

  console.info("[sms:skipped]", { to, reason: `Unsupported provider: ${provider}` });
  return { sent: false, skipped: `Unsupported SMS provider: ${provider}` };
}

/** Mask secrets before returning config to the admin UI. */
export function sanitizeIntegrationConfig(channel: IntegrationChannel, config: Record<string, unknown>) {
  const next = { ...config };
  if (channel === "sms") {
    if (next.authToken) next.authToken = "••••••••";
  }
  if (channel === "email") {
    if (next.pass) next.pass = "••••••••";
  }
  return next;
}
