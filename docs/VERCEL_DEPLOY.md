# Deploy Vasritha on Vercel

This repo is an npm workspace monorepo. The Next.js app lives in **`apps/web`**.

## How deploy works in this repo

Root **`vercel.json`** tells Vercel to run the Next.js builder on `apps/web/package.json`. That way `.next` is created in the correct app folder even when the Vercel project root is the git repo root.

You do **not** need to copy `.next` to the repo root.

## Vercel dashboard settings (important)

Open **Vercel → vasritha → Settings → General → Build & Development Settings**:

| Setting | Value |
| --- | --- |
| **Root Directory** | *(leave empty)* **or** `apps/web` — either works with this repo config |
| **Framework Preset** | Next.js |
| **Build Command** | *(leave empty — do not override)* |
| **Output Directory** | *(leave completely empty — never type `.next`)* |
| **Install Command** | *(leave empty)* |

### If you see `routes-manifest.json` could not be found

1. Clear **Output Directory** (most common cause).
2. Clear any custom **Build Command** override.
3. Redeploy the latest commit (do not only “Retry” an old failed deploy).

| Wrong setup | Error |
| --- | --- |
| Output Directory set to `.next` manually | `routes-manifest.json` not found |
| Custom build that skips `next build` | Incomplete `.next` folder |
| Copying `apps/web/.next` to repo root | `_global-error` Lambda not found |

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
