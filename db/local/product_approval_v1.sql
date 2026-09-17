-- Product 2-step approval statuses
do $$ begin
  alter type public.product_status add value if not exists 'pending_approval';
exception when duplicate_object then null;
end $$;

do $$ begin
  alter type public.product_status add value if not exists 'rejected';
exception when duplicate_object then null;
end $$;
