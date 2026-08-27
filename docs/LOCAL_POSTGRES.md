# Local PostgreSQL setup (temporary)

Backend uses **local PostgreSQL** (pgAdmin), not Supabase.

## Your current DB (from pgAdmin)
- Database name: `vasritha`
- Owner: `postgres`
- Host: `127.0.0.1`
- Port: `5433` (see `apps/web/.env.local`)

## 1. Update password in env

Open `apps/web/.env.local` and set:

```env
DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5433/vasritha
USE_LOCAL_POSTGRES=true
JWT_SECRET=vasritha-local-dev-secret-change-me
```

## 2. Apply schema + optimize + seed admin

From project root:

```bash
npm run db:init
npm run db:optimize
npm run db:seed:catalog
npm run db:patch:product-parent
npm run db:patch:gst-hsn
npm run db:patch:shops
npm run db:patch:cart-reservations
npm run db:patch:brands
npm run db:patch:loyalty
```

- Schema: `db/local/schema.sql` (includes `products.parent_product_id` for Case 2 design groups)
- Integrity upgrade: `db/local/optimize_v1.sql`
- Parent–child patch (existing DBs): `db/local/product_parent_v1.sql` via `npm run db:patch:product-parent`
- GST / HSN (products + invoice snapshots): `db/local/gst_hsn_v1.sql` via `npm run db:patch:gst-hsn`
- Multi-shop locations: `db/local/shops_v1.sql` via `npm run db:patch:shops` (seeds `MAIN` shop)
- Cart 30-min stock holds: `db/local/cart_reservations_v1.sql` via `npm run db:patch:cart-reservations`
- Multi-brand plugins (Sukadhaa ops + Vasritha sales brand): `db/local/brands_v1.sql` via `npm run db:patch:brands`
- Loyalty / points (central customers, milestones): `db/local/loyalty_v1.sql` via `npm run db:patch:loyalty`
- Relationship walkthrough for DBA review: [`docs/DATABASE.md`](./DATABASE.md)

**Product models:** Case 1 (saree / dress qty) leaves parent empty and uses unique `product_items` barcodes. Case 2 links child designs via `parent_product_id`; each child still has its own stock and barcodes.

Seeded super admin (created if missing):
- Email: `admin@vasritha.local`
- Password: `Admin@123`

## 3. Start app

```bash
npm run dev:web
```

## 4. Admin UI

Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign in with the seeded admin.

### Domains (production)

Same Next app; hosts are split by middleware:

| Host | Surface |
| --- | --- |
| `vasritha.in` (and www) | Customer website only |
| `sukadhaa.in` (and www) | Ops / admin / POS only (`/` rewrites to `/admin`) |

Set in `apps/web/.env.local` (or hosting env):

```env
NEXT_PUBLIC_SITE_URL=https://vasritha.in
OPS_PUBLIC_URL=https://sukadhaa.in
STOREFRONT_HOSTS=vasritha.in,www.vasritha.in
OPS_HOSTS=sukadhaa.in,www.sukadhaa.in
```

On localhost, leave the host lists empty so both storefront and `/admin` work on port 3000.

## 5. Test auth APIs
- `POST /api/auth/register`
- `POST /api/auth/login` → use `access_token` as Bearer token

## Assign admin role (optional)

```sql
insert into user_roles (user_id, role_id)
select u.id, r.id
from users u
cross join roles r
where u.email = 'your-email@example.com'
  and r.code = 'business_owner';
```
