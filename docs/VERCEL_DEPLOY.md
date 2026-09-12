# Deploy Vasritha on Vercel (`vasritha-web`)

This repo is an npm workspace. The Next.js app is in **`apps/web`**.

Target project example: [vasritha-web on Vercel](https://vercel.com/muthu-karuppaiyas-projects/vasritha-web)

## Dashboard setup (one time)

### 1. Connect GitHub

1. Open [vasritha-web → Settings → Git](https://vercel.com/muthu-karuppaiyas-projects/vasritha-web/settings/git)
2. **Connect Git Repository** → choose `Muthukaruppaiya/vasritha`
3. Production branch: `main`

### 2. Build & Development Settings

Open **Settings → Build and Deployment**:

| Setting | Value |
| --- | --- |
| **Root Directory** | `apps/web` |
| **Framework Preset** | Next.js |
| **Build Command** | *(empty — default `next build`)* |
| **Output Directory** | *(empty — never set `.next`)* |
| **Install Command** | *(empty — or `cd ../.. && npm install`)* |

Save, then **Deployments → Redeploy** the latest `main` commit.

### 3. Environment variables

**Settings → Environment Variables** (add for Production + Preview):

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Supabase Postgres URI (prefer direct / port 5432) |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lnrcglxlnsoetvyntidu.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Product image uploads (service role) |
| `JWT_SECRET` | Auth token signing secret |
| `NEXT_PUBLIC_SITE_URL` | Your Vercel URL, e.g. `https://vasritha-web.vercel.app` |

Optional: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `ADMIN_NOTIFY_EMAIL`

Root `package.json` already includes `allowScripts` for `sharp` and `unrs-resolver` (needed for npm 11+ on Vercel).

## CLI deploy (optional)

From the repo root, after logging into the **Muthu Karuppaiya** Vercel team:

```powershell
npx vercel login
cd apps/web
npx vercel link --yes --scope muthu-karuppaiyas-projects --project vasritha-web
npx vercel --prod
```

Prefer Git-connected deploys so every push to `main` updates production automatically.

## After first successful deploy

1. Open the production URL shown in the Vercel dashboard.
2. Confirm `/api/health` returns `{"status":"ok",...}`.
3. Sign in to `/admin/login` with your admin user.
4. If product create / images fail, check env vars and run DB patches once (see below).

## One-time database patches

```powershell
$env:DATABASE_URL="postgresql://postgres.xxxx:YOUR_PASSWORD@aws-0-ap-south-1.pooler.supabase.com:5432/postgres"
npm run db:patch:vercel-products:prod
npm run db:patch:integrations
```

Or run the SQL under `db/local/` in the Supabase SQL editor.
