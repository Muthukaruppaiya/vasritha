/**
 * Monorepo deploy helper: Next.js builds to apps/web/.next but Vercel expects
 * .next at the project root when Root Directory is the repo root.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";

const srcNext = path.join("apps", "web", ".next");
const destNext = ".next";
const manifest = path.join(srcNext, "routes-manifest.json");

if (!existsSync(manifest)) {
  console.error(`[vercel] Missing ${manifest}. The Next.js build did not finish.`);
  process.exit(1);
}

if (existsSync(destNext)) {
  rmSync(destNext, { recursive: true, force: true });
}

cpSync(srcNext, destNext, { recursive: true });
console.log(`[vercel] Copied ${srcNext} -> ${destNext}`);
