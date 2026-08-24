import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

dotenv.config({ path: ".vercel/.env.production.local", quiet: true });
process.env.DATABASE_URL = process.env.RUDYO_DB_DATABASE_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL;
const result = spawnSync(process.execPath, ["node_modules/prisma/build/index.js", ...process.argv.slice(2)], {
  cwd: process.cwd(), env: process.env, stdio: "inherit", windowsHide: true,
});
process.exit(result.status ?? 1);
