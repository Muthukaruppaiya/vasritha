-- Loyalty / points foundation (safe to re-run)
-- Usage: npm run db:patch:loyalty

alter table public.customers
  add column if not exists loyalty_points integer not null default 0;

alter table public.orders
  add column if not exists loyalty_points_earned integer not null default 0;

alter table public.orders
  add column if not exists loyalty_balance_after integer;

alter table public.orders
  add column if not exists loyalty_prompt text;

create table if not exists public.loyalty_rules (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  rule_type text not null check (rule_type in (
    'earn_rate',
    'spend_milestone',
    'visit_count'
  )),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  channel text not null default 'all' check (channel in ('all', 'online', 'pos')),
  -- earn_rate: points granted per amount_unit of paid order total
  points_per_amount numeric(12,2) not null default 1,
  amount_unit numeric(12,2) not null default 100,
  -- spend_milestone / visit_count thresholds
  min_lifetime_spend numeric(12,2) not null default 0,
  min_order_count integer not null default 0,
  -- when spend is within this of the milestone, show "spend more" prompt
  near_gap numeric(12,2) not null default 2000,
  reward_type text not null default 'message' check (reward_type in (
    'message', 'percent', 'fixed', 'points'
  )),
  reward_value numeric(12,2) not null default 0,
  message_template text,
  unlocked_message text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loyalty_rules_code_nonempty check (length(trim(code)) > 0),
  constraint loyalty_rules_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists loyalty_rules_code_unique_idx
  on public.loyalty_rules (lower(code));

create index if not exists loyalty_rules_active_idx
  on public.loyalty_rules (is_active, sort_order, rule_type);

create table if not exists public.loyalty_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  order_id uuid references public.orders(id) on delete set null,
  entry_type text not null check (entry_type in ('earn', 'redeem', 'adjust')),
  points integer not null,
  balance_after integer not null default 0,
  channel text,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists loyalty_ledger_customer_idx
  on public.loyalty_ledger (customer_id, created_at desc);

create index if not exists loyalty_ledger_order_idx
  on public.loyalty_ledger (order_id)
  where order_id is not null;

create unique index if not exists loyalty_ledger_order_earn_uidx
  on public.loyalty_ledger (order_id)
  where order_id is not null and entry_type = 'earn';

comment on table public.loyalty_rules is
  'Dynamic loyalty rules (earn rate, spend milestones, visit counts).';
comment on table public.loyalty_ledger is
  'Points ledger for centralized customers (website + store).';

-- Seed defaults (only when empty)
insert into public.loyalty_rules (
  code, name, rule_type, is_active, sort_order, channel,
  points_per_amount, amount_unit, message_template
)
select
  'EARN_100',
  'Earn 1 point per ₹100',
  'earn_rate',
  true,
  0,
  'all',
  1,
  100,
  'You earn {points} points on this purchase.'
where not exists (select 1 from public.loyalty_rules);

insert into public.loyalty_rules (
  code, name, rule_type, is_active, sort_order, channel,
  min_lifetime_spend, near_gap, reward_type, reward_value,
  message_template, unlocked_message
)
select
  'SPEND_5K_10PCT',
  '₹5000 spend → 10% offer',
  'spend_milestone',
  true,
  10,
  'all',
  5000,
  2000,
  'percent',
  10,
  'Spend ₹{remaining} more to unlock {reward_value}% off on your next purchase.',
  'Unlocked: {reward_value}% loyalty offer on your next purchase. Tell the cashier / apply at checkout.'
where not exists (select 1 from public.loyalty_rules where code = 'SPEND_5K_10PCT');

insert into public.loyalty_rules (
  code, name, rule_type, is_active, sort_order, channel,
  min_order_count, reward_type, reward_value,
  message_template, unlocked_message
)
select
  'VISIT_3',
  '3 purchases loyalty shout-out',
  'visit_count',
  true,
  20,
  'all',
  3,
  'message',
  0,
  'Shop {remaining} more time(s) to unlock a loyalty thank-you offer.',
  'Thank you for shopping with us 3+ times — ask about your loyalty offer!'
where not exists (select 1 from public.loyalty_rules where code = 'VISIT_3');
