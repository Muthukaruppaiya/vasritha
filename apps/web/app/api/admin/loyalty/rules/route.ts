import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import {
  ensureLoyaltySchema,
  listLoyaltyRules,
  type LoyaltyRule
} from "../../../../../lib/loyalty";

export async function GET(request: NextRequest) {
  const { error } = await requirePermission(request, "settings:business");
  if (error) return error;

  await ensureLoyaltySchema();
  const data = await listLoyaltyRules();
  return ok(data);
}

export async function POST(request: NextRequest) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureLoyaltySchema();
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body?.code || !body?.name || !body?.rule_type) {
    return fail("code, name and rule_type are required");
  }

  const code = String(body.code).trim().toUpperCase().replace(/\s+/g, "_");
  const ruleType = String(body.rule_type);
  if (!["earn_rate", "spend_milestone", "visit_count"].includes(ruleType)) {
    return fail("Invalid rule_type");
  }

  const clash = await queryOne<{ id: string }>(
    `select id from loyalty_rules where lower(code) = lower($1)`,
    [code]
  );
  if (clash) return fail(`Rule code ${code} already exists`);

  const created = await queryOne<LoyaltyRule>(
    `insert into loyalty_rules (
       code, name, rule_type, is_active, sort_order, channel,
       points_per_amount, amount_unit, min_lifetime_spend, min_order_count, near_gap,
       reward_type, reward_value, message_template, unlocked_message, notes
     ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     returning *`,
    [
      code,
      String(body.name).trim(),
      ruleType,
      body.is_active === false ? false : true,
      Number(body.sort_order || 0),
      ["all", "online", "pos"].includes(String(body.channel)) ? String(body.channel) : "all",
      Number(body.points_per_amount ?? 1),
      Number(body.amount_unit ?? 100),
      Number(body.min_lifetime_spend ?? 0),
      Number(body.min_order_count ?? 0),
      Number(body.near_gap ?? 2000),
      ["message", "percent", "fixed", "points"].includes(String(body.reward_type))
        ? String(body.reward_type)
        : "message",
      Number(body.reward_value ?? 0),
      body.message_template ? String(body.message_template) : null,
      body.unlocked_message ? String(body.unlocked_message) : null,
      body.notes ? String(body.notes) : null
    ]
  );

  if (!created) return fail("Could not create rule", 500);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "create",
    entityType: "loyalty_rules",
    entityId: created.id,
    after: created
  });

  return ok(created, 201);
}
