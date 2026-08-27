import { NextRequest } from "next/server";
import { fail, ok, requirePermission, writeAuditLog } from "../../../../../lib/auth/api";
import { query, queryOne } from "../../../../../lib/db/pool";
import { ensureLoyaltySchema, type LoyaltyRule } from "../../../../../lib/loyalty";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureLoyaltySchema();
  const { id } = await params;
  const before = await queryOne<LoyaltyRule>(`select * from loyalty_rules where id = $1`, [id]);
  if (!before) return fail("Rule not found", 404);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return fail("Invalid body");

  const updates: string[] = [];
  const values: unknown[] = [];

  const set = (col: string, value: unknown) => {
    values.push(value);
    updates.push(`${col} = $${values.length}`);
  };

  if ("name" in body) set("name", String(body.name || "").trim());
  if ("code" in body) {
    const code = String(body.code).trim().toUpperCase().replace(/\s+/g, "_");
    const clash = await queryOne<{ id: string }>(
      `select id from loyalty_rules where lower(code) = lower($1) and id <> $2`,
      [code, id]
    );
    if (clash) return fail(`Rule code ${code} already exists`);
    set("code", code);
  }
  if ("rule_type" in body) {
    const ruleType = String(body.rule_type);
    if (!["earn_rate", "spend_milestone", "visit_count"].includes(ruleType)) {
      return fail("Invalid rule_type");
    }
    set("rule_type", ruleType);
  }
  if ("is_active" in body) set("is_active", Boolean(body.is_active));
  if ("sort_order" in body) set("sort_order", Number(body.sort_order || 0));
  if ("channel" in body) {
    const channel = String(body.channel);
    set("channel", ["all", "online", "pos"].includes(channel) ? channel : "all");
  }
  if ("points_per_amount" in body) set("points_per_amount", Number(body.points_per_amount ?? 1));
  if ("amount_unit" in body) set("amount_unit", Number(body.amount_unit ?? 100));
  if ("min_lifetime_spend" in body) set("min_lifetime_spend", Number(body.min_lifetime_spend ?? 0));
  if ("min_order_count" in body) set("min_order_count", Number(body.min_order_count ?? 0));
  if ("near_gap" in body) set("near_gap", Number(body.near_gap ?? 2000));
  if ("reward_type" in body) {
    const rewardType = String(body.reward_type);
    set(
      "reward_type",
      ["message", "percent", "fixed", "points"].includes(rewardType) ? rewardType : "message"
    );
  }
  if ("reward_value" in body) set("reward_value", Number(body.reward_value ?? 0));
  if ("message_template" in body) {
    set(
      "message_template",
      body.message_template == null || String(body.message_template).trim() === ""
        ? null
        : String(body.message_template)
    );
  }
  if ("unlocked_message" in body) {
    set(
      "unlocked_message",
      body.unlocked_message == null || String(body.unlocked_message).trim() === ""
        ? null
        : String(body.unlocked_message)
    );
  }
  if ("notes" in body) {
    set(
      "notes",
      body.notes == null || String(body.notes).trim() === "" ? null : String(body.notes)
    );
  }

  if (!updates.length) return fail("No fields to update");
  updates.push("updated_at = now()");
  values.push(id);

  const data = await queryOne<LoyaltyRule>(
    `update loyalty_rules set ${updates.join(", ")} where id = $${values.length} returning *`,
    values
  );
  if (!data) return fail("Update failed", 500);

  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "update",
    entityType: "loyalty_rules",
    entityId: id,
    before,
    after: data
  });

  return ok(data);
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { error, ctx } = await requirePermission(request, "settings:business");
  if (error || !ctx) return error;

  await ensureLoyaltySchema();
  const { id } = await params;
  const before = await queryOne<LoyaltyRule>(`select * from loyalty_rules where id = $1`, [id]);
  if (!before) return fail("Rule not found", 404);

  await query(`delete from loyalty_rules where id = $1`, [id]);
  await writeAuditLog({
    actorUserId: ctx.userId,
    action: "delete",
    entityType: "loyalty_rules",
    entityId: id,
    before
  });
  return ok({ id, deleted: true });
}
