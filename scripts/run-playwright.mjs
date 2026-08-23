import { delimiter, dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const binName = process.platform === "win32" ? "playwright.cmd" : "playwright";
const binDirectory = (process.env.PATH || "").split(delimiter).find((entry) => existsSync(join(entry, binName)));
if (!binDirectory) {
  console.error("Playwright est introuvable. Exécutez npm install avant les tests E2E.");
  process.exit(1);
}
const modulesDirectory = dirname(binDirectory);
const playwrightCli = join(modulesDirectory, "@playwright", "test", "cli.js");
const result = spawnSync(process.execPath, [playwrightCli, ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: { ...process.env, NODE_PATH: modulesDirectory },
  stdio: "inherit",
  shell: false,
});
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
