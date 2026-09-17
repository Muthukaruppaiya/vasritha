-- Category publish/unpublish for storefront visibility
alter table categories
  add column if not exists is_published boolean not null default true;
