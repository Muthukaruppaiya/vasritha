alter table public.coupons
  add column if not exists kind text not null default 'coupon',
  add column if not exists show_on_open boolean not null default false,
  add column if not exists headline text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'coupons_kind_check'
  ) then
    alter table public.coupons
      add constraint coupons_kind_check check (kind in ('coupon', 'gift_voucher'));
  end if;
end $$;

create index if not exists coupons_open_notice_idx
  on public.coupons (show_on_open, status, created_at desc)
  where show_on_open = true and status = 'active';

comment on column public.coupons.show_on_open is 'When true, show this voucher as the website opening notice.';
comment on column public.coupons.kind is 'coupon = checkout code, gift_voucher = opening notice + checkout code.';
