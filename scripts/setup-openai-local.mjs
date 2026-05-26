import { existsSync, readFileSync, writeFileSync } from "node:fs";

const targetEnvFile = ".env.local";
const sourceEnvFiles = [".env.local", ".env.production.local", ".env"];

function parseEnvLine(line) {
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
  if (!match) return null;

  const [, key, rawValue] = match;
  const trimmed = rawValue.trim();
  const value =
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
      ? trimmed.slice(1, -1)
      : trimmed;

  return { key, value };
}

function readEnvValue(file, key) {
  if (!existsSync(file)) return "";

  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const parsed = parseEnvLine(line.trim());
    if (parsed?.key === key && parsed.value) {
      return parsed.value;
    }
  }

  return "";
}

function findOpenAiKey() {
  if (process.env.OPENAI_API_KEY?.trim()) {
    return process.env.OPENAI_API_KEY.trim();
  }

  for (const file of sourceEnvFiles) {
    const value = readEnvValue(file, "OPENAI_API_KEY");
    if (value) return value;
  }

  return "";
}

function upsertEnv(lines, key, value) {
  const index = lines.findIndex((line) => line.startsWith(`${key}=`));
  const safeValue = value.includes("\n") ? JSON.stringify(value) : `"${value}"`;

  if (index >= 0) {
    lines[index] = `${key}=${safeValue}`;
  } else {
    lines.push(`${key}=${safeValue}`);
  }
}

const openAiKey = findOpenAiKey();

if (!openAiKey) {
  console.error("OPENAI_API_KEY introuvable dans l'environnement local.");
  process.exit(1);
}

const lines = existsSync(targetEnvFile)
  ? readFileSync(targetEnvFile, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
  : [];

upsertEnv(lines, "OPENAI_API_KEY", openAiKey);
upsertEnv(lines, "AI_PROVIDER", "openai");
upsertEnv(lines, "USE_MOCK_STORYBOARD", "false");
upsertEnv(lines, "USE_LOCAL_SESSION", "true");
upsertEnv(lines, "NEXT_PUBLIC_APP_URL", "http://localhost:3000");

writeFileSync(targetEnvFile, lines.join("\n") + "\n", "utf8");

console.log("Mode OpenAI activé dans .env.local.");
console.log("OPENAI_API_KEY réutilisée sans affichage de la clé.");
