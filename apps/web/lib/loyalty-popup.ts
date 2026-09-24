import { query, queryOne } from "./db/pool";
import { skipRuntimeSchemaEnsure } from "./schema-bootstrap";
import { listLoyaltyRules } from "./loyalty";

export type LoyaltyPopupSettings = {
  enabled: boolean;
  title: string;
  message: string;
  image_path: string | null;
  guest_cta_label: string;
  guest_cta_href: string;
  login_cta_label: string;
  member_cta_label: string;
  member_cta_href: string;
  delay_ms: number;
  show_once_per_session: boolean;
  homepage_only: boolean;
};

export type LoyaltyPopupPublic = LoyaltyPopupSettings & {
  /** Benefit teaser from active loyalty rules (not invented discounts). */
  benefit_teaser: string | null;
};

const DEFAULTS: LoyaltyPopupSettings = {
  enabled: true,
  title: "Vasritha Loyalty",
  message: "Join our loyalty program and get exclusive offers!",
  image_path: null,
  guest_cta_label: "Join Now",
  guest_cta_href: "/account/register",
  login_cta_label: "Login",
  member_cta_label: "View my account",
  member_cta_href: "/account",
  delay_ms: 4500,
  show_once_per_session: true,
  homepage_only: true
};

let schemaReady = false;

export async function ensureLoyaltyPopupSchema() {
  if (schemaReady || skipRuntimeSchemaEnsure()) {
    schemaReady = true;
    return;
  }

  await query(`
    alter table public.site_settings
      add column if not exists loyalty_popup_enabled boolean not null default true,
      add column if not exists loyalty_popup_title text,
      add column if not exists loyalty_popup_message text,
      add column if not exists loyalty_popup_image_path text,
      add column if not exists loyalty_popup_guest_cta_label text,
      add column if not exists loyalty_popup_guest_cta_href text,
      add column if not exists loyalty_popup_login_cta_label text,
      add column if not exists loyalty_popup_member_cta_label text,
      add column if not exists loyalty_popup_member_cta_href text,
      add column if not exists loyalty_popup_delay_ms integer not null default 4500,
      add column if not exists loyalty_popup_show_once_per_session boolean not null default true,
      add column if not exists loyalty_popup_homepage_only boolean not null default true
  `);

  await query(`
    update public.site_settings
    set loyalty_popup_title = coalesce(nullif(loyalty_popup_title, ''), $1),
        loyalty_popup_message = coalesce(nullif(loyalty_popup_message, ''), $2),
        loyalty_popup_guest_cta_label = coalesce(nullif(loyalty_popup_guest_cta_label, ''), $3),
        loyalty_popup_guest_cta_href = coalesce(nullif(loyalty_popup_guest_cta_href, ''), $4),
        loyalty_popup_login_cta_label = coalesce(nullif(loyalty_popup_login_cta_label, ''), $5),
        loyalty_popup_member_cta_label = coalesce(nullif(loyalty_popup_member_cta_label, ''), $6),
        loyalty_popup_member_cta_href = coalesce(nullif(loyalty_popup_member_cta_href, ''), $7)
    where true
  `, [
    DEFAULTS.title,
    DEFAULTS.message,
    DEFAULTS.guest_cta_label,
    DEFAULTS.guest_cta_href,
    DEFAULTS.login_cta_label,
    DEFAULTS.member_cta_label,
    DEFAULTS.member_cta_href
  ]);

  schemaReady = true;
}

async function benefitTeaserFromRules(): Promise<string | null> {
  const rules = await listLoyaltyRules({ activeOnly: true });
  const online = rules.filter((r) => r.channel === "all" || r.channel === "online");
  const milestone =
    online.find((r) => r.rule_type === "spend_milestone") ||
    online.find((r) => r.rule_type === "visit_count") ||
    online.find((r) => r.rule_type === "earn_rate");
  if (!milestone) return null;

  const unlocked = milestone.unlocked_message?.trim();
  if (unlocked && !unlocked.includes("{")) return unlocked;
  if (milestone.name?.trim()) return milestone.name.trim();
  return null;
}

export async function getLoyaltyPopupSettings(): Promise<LoyaltyPopupSettings> {
  await ensureLoyaltyPopupSchema();
  const row = await queryOne<{
    loyalty_popup_enabled: boolean | null;
    loyalty_popup_title: string | null;
    loyalty_popup_message: string | null;
    loyalty_popup_image_path: string | null;
    loyalty_popup_guest_cta_label: string | null;
    loyalty_popup_guest_cta_href: string | null;
    loyalty_popup_login_cta_label: string | null;
    loyalty_popup_member_cta_label: string | null;
    loyalty_popup_member_cta_href: string | null;
    loyalty_popup_delay_ms: number | string | null;
    loyalty_popup_show_once_per_session: boolean | null;
    loyalty_popup_homepage_only: boolean | null;
  }>(
    `select loyalty_popup_enabled, loyalty_popup_title, loyalty_popup_message,
            loyalty_popup_image_path, loyalty_popup_guest_cta_label, loyalty_popup_guest_cta_href,
            loyalty_popup_login_cta_label, loyalty_popup_member_cta_label, loyalty_popup_member_cta_href,
            loyalty_popup_delay_ms, loyalty_popup_show_once_per_session, loyalty_popup_homepage_only
     from site_settings
     limit 1`
  );

  return {
    enabled: row?.loyalty_popup_enabled !== false,
    title: row?.loyalty_popup_title?.trim() || DEFAULTS.title,
    message: row?.loyalty_popup_message?.trim() || DEFAULTS.message,
    image_path: row?.loyalty_popup_image_path?.trim() || null,
    guest_cta_label: row?.loyalty_popup_guest_cta_label?.trim() || DEFAULTS.guest_cta_label,
    guest_cta_href: row?.loyalty_popup_guest_cta_href?.trim() || DEFAULTS.guest_cta_href,
    login_cta_label: row?.loyalty_popup_login_cta_label?.trim() || DEFAULTS.login_cta_label,
    member_cta_label: row?.loyalty_popup_member_cta_label?.trim() || DEFAULTS.member_cta_label,
    member_cta_href: row?.loyalty_popup_member_cta_href?.trim() || DEFAULTS.member_cta_href,
    delay_ms: Math.max(0, Math.min(60000, Number(row?.loyalty_popup_delay_ms ?? DEFAULTS.delay_ms))),
    show_once_per_session: row?.loyalty_popup_show_once_per_session !== false,
    homepage_only: row?.loyalty_popup_homepage_only !== false
  };
}

export async function getLoyaltyPopupPublic(): Promise<LoyaltyPopupPublic | null> {
  const settings = await getLoyaltyPopupSettings();
  if (!settings.enabled) return null;
  const benefit_teaser = await benefitTeaserFromRules().catch(() => null);
  return { ...settings, benefit_teaser };
}

export async function updateLoyaltyPopupSettings(
  patch: Partial<LoyaltyPopupSettings>
): Promise<LoyaltyPopupSettings> {
  await ensureLoyaltyPopupSchema();
  const existing = await queryOne<{ id: string }>(`select id from site_settings limit 1`);
  if (!existing) throw new Error("Settings row missing");

  const updates: string[] = [];
  const values: unknown[] = [];

  const map: Array<[keyof LoyaltyPopupSettings, string]> = [
    ["enabled", "loyalty_popup_enabled"],
    ["title", "loyalty_popup_title"],
    ["message", "loyalty_popup_message"],
    ["image_path", "loyalty_popup_image_path"],
    ["guest_cta_label", "loyalty_popup_guest_cta_label"],
    ["guest_cta_href", "loyalty_popup_guest_cta_href"],
    ["login_cta_label", "loyalty_popup_login_cta_label"],
    ["member_cta_label", "loyalty_popup_member_cta_label"],
    ["member_cta_href", "loyalty_popup_member_cta_href"],
    ["delay_ms", "loyalty_popup_delay_ms"],
    ["show_once_per_session", "loyalty_popup_show_once_per_session"],
    ["homepage_only", "loyalty_popup_homepage_only"]
  ];

  for (const [key, column] of map) {
    if (key in patch) {
      values.push(patch[key] ?? null);
      updates.push(`${column} = $${values.length}`);
    }
  }

  if (updates.length) {
    updates.push("updated_at = now()");
    values.push(existing.id);
    await query(
      `update site_settings set ${updates.join(", ")} where id = $${values.length}`,
      values
    );
  }

  return getLoyaltyPopupSettings();
}
