# Deploy Vasritha on Vercel

This repo is an npm workspace monorepo. The Next.js app lives in `apps/web`.

## Recommended Vercel project settings

Open **Vercel → Project → Settings → General → Build & Development Settings**:

| Setting | Value |
| --- | --- |
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | leave empty (default `next build`) |
| **Output Directory** | leave empty (do **not** set `.next` manually) |
| **Install Command** | leave empty (Vercel installs from the monorepo root automatically) |

If **Output Directory** is set to `.next` while **Root Directory** is wrong, deploy fails with:

`The file ".next/routes-manifest.json" couldn't be found`

Clear **Output Directory** and set **Root Directory** to `apps/web`.

## Alternative (repo root as Vercel root)

If you keep **Root Directory** empty, the root `vercel.json` runs `npm run vercel-build`, which:

1. Builds `@vasritha/web`
2. Copies `apps/web/.next` → `.next` for Vercel packaging

## Required environment variables

Set these on Vercel (Production + Preview):

- `DATABASE_URL` — Supabase direct Postgres URI (port 5432)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — needed for product image uploads
- `JWT_SECRET` — auth signing secret
- `NEXT_PUBLIC_SITE_URL` — e.g. `https://vasritha.vercel.app`

Optional:

- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` — outbound email
- `ADMIN_NOTIFY_EMAIL` or `support_email` in site settings — review alerts

## One-time database patches (production)

Run from your machine against Supabase (real URI, not placeholders):

```powershell
$env:DATABASE_URL="postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
npm run db:patch:vercel-products:prod
npm run db:patch:integrations
```

Or apply the same SQL in the Supabase SQL editor.
