# Deploy Vasritha on Vercel

This repo is an npm workspace monorepo. The Next.js app lives in **`apps/web`**.

## Required Vercel settings (do this first)

Open **Vercel → vasritha → Settings → General → Build & Development Settings**:

| Setting | Value |
| --- | --- |
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | *(leave empty — default `next build`)* |
| **Output Directory** | *(leave empty — do not type `.next`)* |
| **Install Command** | *(leave empty — Vercel installs from the monorepo root)* |

### Why this matters

| Wrong setup | Error you see |
| --- | --- |
| Root Directory empty + Output Directory empty | `.next/routes-manifest.json` not found at repo root |
| Copy `.next` to repo root (old workaround) | `_global-error` Lambda / EdgeFunction not found |
| Output Directory set to `.next` manually | Same manifest / function path errors |

**Do not copy `apps/web/.next` to the repo root.** Vercel must build and deploy from `apps/web` directly.

After changing Root Directory, click **Redeploy** (not just retry the failed build).

## Environment variables

Set on Vercel (Production + Preview):

- `DATABASE_URL` — Supabase Postgres URI (port 5432)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — product image uploads
- `JWT_SECRET`
- `NEXT_PUBLIC_SITE_URL` — e.g. `https://vasritha.vercel.app`

Optional email:

- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`
- `ADMIN_NOTIFY_EMAIL` or support email in site settings

## npm install scripts (monorepo root)

Root `package.json` includes `allowScripts` for `sharp` and `unrs-resolver` so npm 11+ strict mode passes on Vercel.

## One-time database patches (production)

```powershell
$env:DATABASE_URL="postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
npm run db:patch:vercel-products:prod
npm run db:patch:integrations
```

Or run the SQL from `db/local/` in the Supabase SQL editor.
