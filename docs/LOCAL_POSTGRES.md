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
```

- Schema: `db/local/schema.sql`
- Integrity upgrade: `db/local/optimize_v1.sql`
- Relationship walkthrough for DBA review: [`docs/DATABASE.md`](./DATABASE.md)

Seeded super admin (created if missing):
- Email: `admin@vasritha.local`
- Password: `Admin@123`

## 3. Start app

```bash
npm run dev:web
```

## 4. Admin UI

Open [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign in with the seeded admin.

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
