# Deploy Vasritha on Vercel

Primary production host for this repo is **Vercel**. The Next.js app lives in **`apps/web`**.

Config: `apps/web/vercel.json` (framework Next.js, region Mumbai `bom1`).

## Dashboard setup

### 1. Git

1. Connect the GitHub repo to the Vercel project
2. Production branch: `main`
3. Root Directory: `apps/web`

### 2. Build settings

| Setting | Value |
| --- | --- |
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | default (`next build`) |
| **Install Command** | `cd ../.. && npm install` (also in `vercel.json`) |
| **Region** | Mumbai (`bom1`) — same region as Supabase `ap-south-1` |

### 3. Environment variables

Set for Production + Preview:

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase **pooler transaction** URI (`*.pooler.supabase.com`, port **6543`) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Preferred for uploads (Storage). If missing, falls back to Postgres `/api/media` |
| `JWT_SECRET` | Auth token signing secret |
| `NEXT_PUBLIC_SITE_URL` | Public site URL (custom domain or `https://….vercel.app`) |
| `STOREFRONT_HOSTS` | Optional: `vasritha.in,www.vasritha.in` |
| `OPS_HOSTS` | Optional: ops / admin hostnames |
| `OPS_PUBLIC_URL` | Optional: canonical admin URL |

Optional: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `ADMIN_NOTIFY_EMAIL`

## CLI deploy

```powershell
npx vercel login
cd apps/web
npx vercel link --yes
npx vercel --prod
```

Prefer Git-connected deploys so every push to `main` updates production.

## After deploy

1. Open the production URL and check `/api/health`.
2. Sign in at `/admin/login`.
3. If product create / images fail:

```powershell
$env:DATABASE_URL="postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"
npm run db:patch:products:prod
```

## Note on Netlify

Root `netlify.toml` is legacy / unused. Do not treat Netlify as the production host.
