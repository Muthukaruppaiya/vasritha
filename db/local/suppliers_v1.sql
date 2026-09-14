-- Supplier master for GRN / purchases
create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  trade_name text,
  contact_person text,
  phone text,
  email text,
  address text,
  city text,
  state text,
  state_code text,
  pincode text,
  gstin text,
  pan text,
  bank_name text,
  bank_account text,
  bank_ifsc text,
  payment_terms text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint suppliers_code_nonempty check (length(trim(code)) > 0),
  constraint suppliers_name_nonempty check (length(trim(name)) > 0)
);

create unique index if not exists suppliers_code_unique_idx
  on public.suppliers (lower(code));

create unique index if not exists suppliers_gstin_unique_idx
  on public.suppliers (upper(gstin))
  where gstin is not null and length(trim(gstin)) > 0;

create index if not exists suppliers_active_name_idx
  on public.suppliers (is_active, name);

alter table public.inventory_movements
  add column if not exists supplier_id uuid references public.suppliers(id);

create index if not exists inventory_movements_supplier_id_idx
  on public.inventory_movements (supplier_id)
  where supplier_id is not null;

grant select, insert, update, delete on public.suppliers to vasritha_vercel;
