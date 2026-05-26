import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envFile = ".env.local";
const defaults = new Map([
  ["USE_LOCAL_SESSION", "true"],
  ["USE_MOCK_STORYBOARD", "true"],
  ["NEXT_PUBLIC_APP_URL", "http://localhost:3000"],
  ["INITIAL_CREDITS", "20"],
]);

const existingLines = existsSync(envFile)
  ? readFileSync(envFile, "utf8").split(/\r?\n/)
  : [];
const nextLines = existingLines.filter((line) => line.trim().length > 0);

for (const [key, value] of defaults) {
  const quotedLine = `${key}="${value}"`;
  const index = nextLines.findIndex((line) => line.startsWith(`${key}=`));

  if (index >= 0) {
    nextLines[index] = quotedLine;
  } else {
    nextLines.push(quotedLine);
  }
}

writeFileSync(envFile, nextLines.join("\n") + "\n", "utf8");

console.log("Configuration locale mise à jour dans .env.local.");
console.log("Lancez ensuite npm run dev:local.");
