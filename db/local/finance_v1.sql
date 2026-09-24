-- Finance v2: extend cashbook + COA + cash/bank (safe to re-run)
-- Usage: npm run db:patch:finance
-- Builds on finance_v1.sql (finance_payment_entries)

-- Base cashbook (idempotent)
create table if not exists public.finance_payment_entries (
  id uuid primary key default gen_random_uuid(),
  entry_no text not null,
  direction text not null check (direction in ('in', 'out')),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'cash',
  status text not null default 'cleared' check (status in ('pending', 'cleared', 'cancelled')),
  entry_date date not null default (current_date),
  counterparty_name text,
  reference_no text,
  notes text,
  order_id uuid references public.orders(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  shop_id uuid,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Chart of accounts
create table if not exists public.finance_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  account_type text not null check (account_type in (
    'asset', 'liability', 'equity', 'income', 'expense'
  )),
  parent_code text,
  is_system boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_accounts_code_nonempty check (length(trim(code)) > 0),
  constraint finance_accounts_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists finance_accounts_code_uidx
  on public.finance_accounts (lower(code));

create index if not exists finance_accounts_type_idx
  on public.finance_accounts (account_type, is_active, code);

-- Cash & bank wallets
create table if not exists public.finance_cash_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  kind text not null check (kind in ('cash', 'bank')),
  opening_balance numeric(14,2) not null default 0,
  is_default boolean not null default false,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint finance_cash_accounts_code_nonempty check (length(trim(code)) > 0)
);

create unique index if not exists finance_cash_accounts_code_uidx
  on public.finance_cash_accounts (lower(code));

-- Extend cashbook columns for integration / idempotency
alter table public.finance_payment_entries
  add column if not exists reference_type text,
  add column if not exists reference_id text,
  add column if not exists customer_id uuid references public.customers(id) on delete set null,
  add column if not exists supplier_id uuid,
  add column if not exists account_id uuid references public.finance_accounts(id) on delete set null,
  add column if not exists cash_account_id uuid references public.finance_cash_accounts(id) on delete set null,
  add column if not exists tax_amount numeric(12,2) not null default 0,
  add column if not exists updated_by uuid references public.users(id) on delete set null;

create unique index if not exists finance_payment_entries_entry_no_uidx
  on public.finance_payment_entries (lower(entry_no));

create unique index if not exists finance_payment_entries_payment_uidx
  on public.finance_payment_entries (payment_id)
  where payment_id is not null;

create unique index if not exists finance_payment_entries_ref_uidx
  on public.finance_payment_entries (reference_type, reference_id)
  where reference_type is not null and reference_id is not null;

create index if not exists finance_payment_entries_date_idx
  on public.finance_payment_entries (entry_date desc, created_at desc);

create index if not exists finance_payment_entries_direction_status_idx
  on public.finance_payment_entries (direction, status, entry_date desc);

create index if not exists finance_payment_entries_order_idx
  on public.finance_payment_entries (order_id)
  where order_id is not null;

create index if not exists finance_payment_entries_customer_idx
  on public.finance_payment_entries (customer_id)
  where customer_id is not null;

create index if not exists finance_payment_entries_supplier_idx
  on public.finance_payment_entries (supplier_id)
  where supplier_id is not null;

-- Finance settings (single-row)
create table if not exists public.finance_settings (
  id integer primary key default 1 check (id = 1),
  fy_start_month integer not null default 4 check (fy_start_month between 1 and 12),
  default_cash_account_id uuid references public.finance_cash_accounts(id) on delete set null,
  default_bank_account_id uuid references public.finance_cash_accounts(id) on delete set null,
  default_sales_account_id uuid references public.finance_accounts(id) on delete set null,
  default_purchase_account_id uuid references public.finance_accounts(id) on delete set null,
  currency text not null default 'INR',
  updated_at timestamptz not null default now()
);

insert into public.finance_settings (id) values (1)
on conflict (id) do nothing;

-- Seed COA (skip if code exists)
insert into public.finance_accounts (code, name, account_type, is_system)
select v.code, v.name, v.account_type, true
from (values
  ('1000', 'Cash', 'asset'),
  ('1010', 'Bank', 'asset'),
  ('1100', 'Accounts Receivable', 'asset'),
  ('1200', 'Inventory', 'asset'),
  ('1900', 'Other Assets', 'asset'),
  ('2000', 'Accounts Payable', 'liability'),
  ('2100', 'Tax Payable', 'liability'),
  ('2900', 'Other Liabilities', 'liability'),
  ('3000', 'Owner Capital', 'equity'),
  ('3100', 'Retained Earnings', 'equity'),
  ('4000', 'Product Sales', 'income'),
  ('4100', 'Service Income', 'income'),
  ('4900', 'Other Income', 'income'),
  ('5000', 'Purchases', 'expense'),
  ('5100', 'Salaries', 'expense'),
  ('5200', 'Rent', 'expense'),
  ('5300', 'Electricity', 'expense'),
  ('5400', 'Internet', 'expense'),
  ('5500', 'Transport', 'expense'),
  ('5600', 'Maintenance', 'expense'),
  ('5700', 'Marketing', 'expense'),
  ('5800', 'Office Expenses', 'expense'),
  ('5900', 'Bank Charges', 'expense'),
  ('5990', 'Other Expenses', 'expense')
) as v(code, name, account_type)
where not exists (
  select 1 from public.finance_accounts a where lower(a.code) = lower(v.code)
);

-- Seed cash / bank wallets
insert into public.finance_cash_accounts (code, name, kind, opening_balance, is_default)
select 'CASH-001', 'Petty Cash', 'cash', 0, true
where not exists (select 1 from public.finance_cash_accounts where lower(code) = 'cash-001');

insert into public.finance_cash_accounts (code, name, kind, opening_balance, is_default)
select 'BANK-001', 'Primary Bank', 'bank', 0, true
where not exists (select 1 from public.finance_cash_accounts where lower(code) = 'bank-001');

update public.finance_settings s
set
  default_cash_account_id = coalesce(s.default_cash_account_id, (select id from finance_cash_accounts where kind = 'cash' and is_default limit 1)),
  default_bank_account_id = coalesce(s.default_bank_account_id, (select id from finance_cash_accounts where kind = 'bank' and is_default limit 1)),
  default_sales_account_id = coalesce(s.default_sales_account_id, (select id from finance_accounts where code = '4000' limit 1)),
  default_purchase_account_id = coalesce(s.default_purchase_account_id, (select id from finance_accounts where code = '5000' limit 1)),
  updated_at = now()
where s.id = 1;

comment on table public.finance_accounts is 'Chart of accounts for SMB finance.';
comment on table public.finance_cash_accounts is 'Cash and bank wallets with opening balances.';
comment on table public.finance_settings is 'Finance module settings (single row).';
