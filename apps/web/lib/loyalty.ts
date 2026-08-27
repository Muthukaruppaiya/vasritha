import { createRequire } from "node:module";
import { query, queryOne } from "./db/pool";
import { normalizePosPhone } from "./pos";

const require = createRequire(import.meta.url);
const bcrypt = require("bcryptjs") as typeof import("bcryptjs");

export type LoyaltyRule = {
  id: string;
  code: string;
  name: string;
  rule_type: "earn_rate" | "spend_milestone" | "visit_count" | string;
  is_active: boolean;
  sort_order: number;
  channel: "all" | "online" | "pos" | string;
  points_per_amount: string | number;
  amount_unit: string | number;
  min_lifetime_spend: string | number;
  min_order_count: number;
  near_gap: string | number;
  reward_type: string;
  reward_value: string | number;
  message_template: string | null;
  unlocked_message: string | null;
  notes: string | null;
  created_at?: string;
  updated_at?: string;
};

export type LoyaltyPrompt = {
  code: string;
  kind: "earn" | "unlocked" | "near" | "info";
  message: string;
  reward_type?: string;
  reward_value?: number;
};

export type LoyaltySnapshot = {
  customer_id: string | null;
  customer_name: string | null;
  phone: string | null;
  points_balance: number;
  lifetime_spend: number;
  paid_order_count: number;
  points_to_earn: number;
  prompts: LoyaltyPrompt[];
  primary_prompt: string | null;
};

export async function ensureLoyaltySchema() {
  await query(`
    alter table public.customers
      add column if not exists loyalty_points integer not null default 0
  `);
  await query(`
    alter table public.orders
      add column if not exists loyalty_points_earned integer not null default 0
  `);
  await query(`
    alter table public.orders
      add column if not exists loyalty_balance_after integer
  `);
  await query(`
    alter table public.orders
      add column if not exists loyalty_prompt text
  `);
  await query(`
    create table if not exists public.loyalty_rules (
      id uuid primary key default gen_random_uuid(),
      code text not null,
      name text not null,
      rule_type text not null,
      is_active boolean not null default true,
      sort_order integer not null default 0,
      channel text not null default 'all',
      points_per_amount numeric(12,2) not null default 1,
      amount_unit numeric(12,2) not null default 100,
      min_lifetime_spend numeric(12,2) not null default 0,
      min_order_count integer not null default 0,
      near_gap numeric(12,2) not null default 2000,
      reward_type text not null default 'message',
      reward_value numeric(12,2) not null default 0,
      message_template text,
      unlocked_message text,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await query(`
    create unique index if not exists loyalty_rules_code_unique_idx
      on public.loyalty_rules (lower(code))
  `);
  await query(`
    create table if not exists public.loyalty_ledger (
      id uuid primary key default gen_random_uuid(),
      customer_id uuid not null references public.customers(id) on delete cascade,
      order_id uuid references public.orders(id) on delete set null,
      entry_type text not null,
      points integer not null,
      balance_after integer not null default 0,
      channel text,
      note text,
      created_at timestamptz not null default now()
    )
  `);
  await query(`
    create index if not exists loyalty_ledger_customer_idx
      on public.loyalty_ledger (customer_id, created_at desc)
  `);
  await query(`
    create unique index if not exists loyalty_ledger_order_earn_uidx
      on public.loyalty_ledger (order_id)
      where order_id is not null and entry_type = 'earn'
  `);

  const count = await queryOne<{ c: number }>(
    `select count(*)::int as c from public.loyalty_rules`
  );
  if (!Number(count?.c || 0)) {
    await query(`
      insert into public.loyalty_rules (
        code, name, rule_type, is_active, sort_order, channel,
        points_per_amount, amount_unit, message_template
      ) values (
        'EARN_100', 'Earn 1 point per ₹100', 'earn_rate', true, 0, 'all',
        1, 100, 'You earn {points} points on this purchase.'
      )
    `);
    await query(`
      insert into public.loyalty_rules (
        code, name, rule_type, is_active, sort_order, channel,
        min_lifetime_spend, near_gap, reward_type, reward_value,
        message_template, unlocked_message
      ) values (
        'SPEND_5K_10PCT', '₹5000 spend → 10% offer', 'spend_milestone', true, 10, 'all',
        5000, 2000, 'percent', 10,
        'Spend ₹{remaining} more to unlock {reward_value}% off on your next purchase.',
        'Unlocked: {reward_value}% loyalty offer on your next purchase. Tell the cashier / apply at checkout.'
      )
    `);
    await query(`
      insert into public.loyalty_rules (
        code, name, rule_type, is_active, sort_order, channel,
        min_order_count, reward_type, message_template, unlocked_message
      ) values (
        'VISIT_3', '3 purchases loyalty shout-out', 'visit_count', true, 20, 'all',
        3, 'message',
        'Shop {remaining} more time(s) to unlock a loyalty thank-you offer.',
        'Thank you for shopping with us 3+ times — ask about your loyalty offer!'
      )
    `);
  }
}

function fillTemplate(
  template: string | null | undefined,
  vars: Record<string, string | number>
) {
  let out = String(template || "").trim();
  if (!out) return "";
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{${key}}`, String(value));
  }
  return out;
}

function channelMatches(ruleChannel: string, channel: "online" | "pos" | "all") {
  return ruleChannel === "all" || ruleChannel === channel;
}

export async function listLoyaltyRules(options?: { activeOnly?: boolean }) {
  await ensureLoyaltySchema();
  if (options?.activeOnly) {
    return query<LoyaltyRule>(
      `select * from loyalty_rules where is_active = true order by sort_order asc, name asc`
    );
  }
  return query<LoyaltyRule>(
    `select * from loyalty_rules order by sort_order asc, name asc`
  );
}

export async function getCustomerLifetimeStats(customerId: string) {
  const row = await queryOne<{ spend: string; orders: number; points: number }>(
    `select
       coalesce((
         select sum(o.total_amount)::text
         from orders o
         where o.customer_id = $1 and o.payment_status = 'paid'
       ), '0') as spend,
       coalesce((
         select count(*)::int
         from orders o
         where o.customer_id = $1 and o.payment_status = 'paid'
       ), 0) as orders,
       coalesce(c.loyalty_points, 0)::int as points
     from customers c
     where c.id = $1`,
    [customerId]
  );
  return {
    lifetime_spend: Number(row?.spend || 0),
    paid_order_count: Number(row?.orders || 0),
    points_balance: Number(row?.points || 0)
  };
}

export function computePointsToEarn(orderTotal: number, rules: LoyaltyRule[]) {
  const earn = rules.find((r) => r.rule_type === "earn_rate" && r.is_active);
  if (!earn) return 0;
  const unit = Math.max(0.01, Number(earn.amount_unit || 100));
  const per = Math.max(0, Number(earn.points_per_amount || 0));
  return Math.floor(Math.max(0, orderTotal) / unit) * per;
}

export function buildLoyaltyPrompts(input: {
  rules: LoyaltyRule[];
  channel: "online" | "pos";
  lifetimeSpend: number;
  paidOrderCount: number;
  pointsBalance: number;
  pointsToEarn: number;
  includeThisOrder?: boolean;
}) {
  const prompts: LoyaltyPrompt[] = [];
  const spend = input.lifetimeSpend;
  const orders = input.paidOrderCount + (input.includeThisOrder ? 1 : 0);

  if (input.pointsToEarn > 0) {
    const earnRule = input.rules.find((r) => r.rule_type === "earn_rate");
    prompts.push({
      code: earnRule?.code || "EARN",
      kind: "earn",
      message:
        fillTemplate(earnRule?.message_template, {
          points: input.pointsToEarn,
          balance: input.pointsBalance + input.pointsToEarn
        }) || `You earn ${input.pointsToEarn} points on this purchase.`
    });
  }

  for (const rule of input.rules) {
    if (!rule.is_active) continue;
    if (!channelMatches(rule.channel, input.channel)) continue;

    if (rule.rule_type === "spend_milestone") {
      const threshold = Number(rule.min_lifetime_spend || 0);
      const nearGap = Number(rule.near_gap || 2000);
      const rewardValue = Number(rule.reward_value || 0);
      if (threshold <= 0) continue;
      if (spend >= threshold) {
        const msg =
          fillTemplate(rule.unlocked_message || rule.message_template, {
            remaining: 0,
            threshold,
            reward_value: rewardValue,
            points: input.pointsBalance
          }) || `Loyalty unlocked at ₹${threshold}.`;
        prompts.push({
          code: rule.code,
          kind: "unlocked",
          message: msg,
          reward_type: rule.reward_type,
          reward_value: rewardValue
        });
      } else {
        const remaining = Math.ceil(threshold - spend);
        if (remaining <= nearGap || remaining <= threshold) {
          const msg =
            fillTemplate(rule.message_template, {
              remaining,
              threshold,
              reward_value: rewardValue,
              points: input.pointsBalance
            }) || `Spend ₹${remaining} more to unlock a loyalty offer.`;
          prompts.push({
            code: rule.code,
            kind: "near",
            message: msg,
            reward_type: rule.reward_type,
            reward_value: rewardValue
          });
        }
      }
    }

    if (rule.rule_type === "visit_count") {
      const need = Number(rule.min_order_count || 0);
      if (need <= 0) continue;
      if (orders >= need) {
        const msg =
          fillTemplate(rule.unlocked_message || rule.message_template, {
            remaining: 0,
            threshold: need,
            reward_value: Number(rule.reward_value || 0),
            points: input.pointsBalance
          }) || `Loyalty visit milestone reached (${need}+ orders).`;
        prompts.push({
          code: rule.code,
          kind: "unlocked",
          message: msg,
          reward_type: rule.reward_type,
          reward_value: Number(rule.reward_value || 0)
        });
      } else {
        const remaining = need - orders;
        const msg =
          fillTemplate(rule.message_template, {
            remaining,
            threshold: need,
            reward_value: Number(rule.reward_value || 0),
            points: input.pointsBalance
          }) || `Shop ${remaining} more time(s) for a loyalty offer.`;
        prompts.push({
          code: rule.code,
          kind: "near",
          message: msg
        });
      }
    }
  }

  // Prefer unlocked, then near, then earn
  const primary =
    prompts.find((p) => p.kind === "unlocked") ||
    prompts.find((p) => p.kind === "near") ||
    prompts.find((p) => p.kind === "earn") ||
    null;

  return { prompts, primary_prompt: primary?.message || null };
}

export async function evaluateLoyaltyForCustomer(input: {
  customerId: string | null;
  channel: "online" | "pos";
  orderTotal?: number;
  phone?: string | null;
  customerName?: string | null;
  /** When true, lifetime stats already include this order (post-paid earn path). */
  orderAlreadyInStats?: boolean;
}): Promise<LoyaltySnapshot> {
  await ensureLoyaltySchema();
  const rules = await listLoyaltyRules({ activeOnly: true });
  const orderTotal = Math.max(0, Number(input.orderTotal || 0));

  if (!input.customerId) {
    const pointsToEarn = computePointsToEarn(orderTotal, rules);
    const built = buildLoyaltyPrompts({
      rules,
      channel: input.channel,
      lifetimeSpend: 0,
      paidOrderCount: 0,
      pointsBalance: 0,
      pointsToEarn,
      includeThisOrder: false
    });
    return {
      customer_id: null,
      customer_name: input.customerName || null,
      phone: input.phone || null,
      points_balance: 0,
      lifetime_spend: 0,
      paid_order_count: 0,
      points_to_earn: pointsToEarn,
      prompts: built.prompts,
      primary_prompt: built.primary_prompt
    };
  }

  const stats = await getCustomerLifetimeStats(input.customerId);
  const customer = await queryOne<{ full_name: string; phone: string | null }>(
    `select full_name, phone from customers where id = $1`,
    [input.customerId]
  );
  const pointsToEarn = computePointsToEarn(orderTotal, rules);
  const projectedSpend = input.orderAlreadyInStats
    ? stats.lifetime_spend
    : stats.lifetime_spend + orderTotal;
  const built = buildLoyaltyPrompts({
    rules,
    channel: input.channel,
    lifetimeSpend: projectedSpend,
    paidOrderCount: stats.paid_order_count,
    pointsBalance: stats.points_balance,
    pointsToEarn,
    includeThisOrder: Boolean(orderTotal > 0 && !input.orderAlreadyInStats)
  });

  return {
    customer_id: input.customerId,
    customer_name: customer?.full_name || input.customerName || null,
    phone: customer?.phone || input.phone || null,
    points_balance: stats.points_balance,
    lifetime_spend: stats.lifetime_spend,
    paid_order_count: stats.paid_order_count,
    points_to_earn: pointsToEarn,
    prompts: built.prompts,
    primary_prompt: built.primary_prompt
  };
}

/** Find or create a real customer for POS / shared loyalty (centralized by phone). */
export async function resolveOrCreateCustomerByPhone(input: {
  name: string;
  phone: string;
  email?: string | null;
}) {
  await ensureLoyaltySchema();
  const phone = normalizePosPhone(input.phone);
  const name = String(input.name || "").trim() || "Customer";
  const email =
    (input.email && String(input.email).trim()) ||
    `pos.${phone}@customer.vasritha.local`;

  const byPhone = await queryOne<{ id: string }>(
    `select id from customers
     where regexp_replace(coalesce(phone, ''), '\\D', '', 'g') like '%' || $1
        or phone = $1
     order by created_at asc
     limit 1`,
    [phone]
  );
  if (byPhone) {
    await query(
      `update customers
       set full_name = case when coalesce(full_name, '') = '' then $2 else full_name end,
           phone = coalesce(nullif(phone, ''), $3),
           email = case
             when email like 'pos.%@customer.vasritha.local' and $4 not like 'pos.%@customer.vasritha.local'
               then $4
             else email
           end
       where id = $1`,
      [byPhone.id, name, phone, email]
    );
    await query(
      `update users set full_name = $2, phone = coalesce(phone, $3) where id = $1`,
      [byPhone.id, name, phone]
    );
    return byPhone.id;
  }

  const byEmail = await queryOne<{ id: string }>(
    `select id from customers where lower(email) = lower($1)`,
    [email]
  );
  if (byEmail) {
    await query(
      `update customers set phone = coalesce(phone, $2), full_name = $3 where id = $1`,
      [byEmail.id, phone, name]
    );
    return byEmail.id;
  }

  const passwordHash = await bcrypt.hash(`pos-${phone}-${Date.now()}`, 8);
  const user = await queryOne<{ id: string }>(
    `insert into users (email, password_hash, full_name, phone)
     values ($1, $2, $3, $4)
     returning id`,
    [email, passwordHash, name, phone]
  );
  if (!user) throw new Error("Could not create customer user");

  await query(
    `insert into customers (id, full_name, email, phone)
     values ($1, $2, $3, $4)
     on conflict (id) do update
       set full_name = excluded.full_name,
           phone = coalesce(customers.phone, excluded.phone)`,
    [user.id, name, email, phone]
  );
  await query(
    `insert into user_roles (user_id, role_id)
     select $1, id from roles where code = 'customer'
     on conflict do nothing`,
    [user.id]
  );
  return user.id;
}

export async function earnLoyaltyForPaidOrder(orderId: string) {
  await ensureLoyaltySchema();

  const order = await queryOne<{
    id: string;
    customer_id: string;
    total_amount: string;
    payment_status: string;
    channel: string | null;
    loyalty_points_earned: number;
    pos_customer_phone: string | null;
    pos_customer_name: string | null;
    pos_customer_email: string | null;
  }>(
    `select id, customer_id, total_amount::text, payment_status, channel,
            coalesce(loyalty_points_earned, 0)::int as loyalty_points_earned,
            pos_customer_phone, pos_customer_name, pos_customer_email
     from orders where id = $1`,
    [orderId]
  );
  if (!order || order.payment_status !== "paid") return null;

  const already = await queryOne<{ id: string }>(
    `select id from loyalty_ledger where order_id = $1 and entry_type = 'earn'`,
    [orderId]
  );
  if (already) return null;

  let customerId = order.customer_id;
  const phone = normalizePosPhone(order.pos_customer_phone || "");
  if (phone.length === 10) {
    customerId = await resolveOrCreateCustomerByPhone({
      name: order.pos_customer_name || "Customer",
      phone,
      email: order.pos_customer_email
    });
    if (customerId !== order.customer_id) {
      await query(`update orders set customer_id = $2 where id = $1`, [
        orderId,
        customerId
      ]);
    }
  }

  const channel = order.channel === "pos" ? "pos" : "online";
  const snapshot = await evaluateLoyaltyForCustomer({
    customerId,
    channel,
    orderTotal: Number(order.total_amount || 0),
    phone,
    customerName: order.pos_customer_name,
    orderAlreadyInStats: true
  });
  const points = snapshot.points_to_earn;
  const balanceAfter = snapshot.points_balance + points;

  if (points > 0) {
    await query(
      `update customers set loyalty_points = loyalty_points + $2 where id = $1`,
      [customerId, points]
    );
    await query(
      `insert into loyalty_ledger (customer_id, order_id, entry_type, points, balance_after, channel, note)
       values ($1, $2, 'earn', $3, $4, $5, $6)`,
      [
        customerId,
        orderId,
        points,
        balanceAfter,
        channel,
        `Earned on order ${orderId}`
      ]
    );
  }

  const prompt =
    snapshot.primary_prompt ||
    (points > 0 ? `You earned ${points} loyalty points.` : null);

  await query(
    `update orders
     set loyalty_points_earned = $2,
         loyalty_balance_after = $3,
         loyalty_prompt = $4
     where id = $1`,
    [orderId, points, balanceAfter, prompt]
  );

  return {
    customer_id: customerId,
    points_earned: points,
    balance_after: balanceAfter,
    prompt,
    prompts: snapshot.prompts
  };
}
