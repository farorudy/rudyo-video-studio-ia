import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd(), true);

const isProduction = process.env.NODE_ENV === "production";
const localSession = process.env.USE_LOCAL_SESSION === "true" && !isProduction;
const mockStoryboard = process.env.USE_MOCK_STORYBOARD === "true";
const aiProvider = process.env.AI_PROVIDER?.trim() || "";
const authSecret = process.env.AUTH_COOKIE_SECRET?.trim() || "";
const databaseUrl = process.env.DATABASE_URL?.trim() || "";
const openAiKey = process.env.OPENAI_API_KEY?.trim() || "";

const checks = [
  {
    name: "AUTH_COOKIE_SECRET",
    ok: authSecret.length >= 32,
    hint: "Ajoutez un secret de 32 caracteres minimum.",
  },
  {
    name: "Session locale",
    ok: localSession,
    hint: "Lancez npm run dev:local pour tester sans PostgreSQL.",
  },
  {
    name: "DATABASE_URL",
    ok: localSession || databaseUrl.length > 0,
    hint: "Ajoutez DATABASE_URL ou activez la session locale en dev.",
  },
  {
    name: "Storyboard",
    ok: mockStoryboard || openAiKey.length > 0,
    hint: "Ajoutez OPENAI_API_KEY ou activez USE_MOCK_STORYBOARD=true.",
  },
  {
    name: "OpenAI provider",
    ok: aiProvider !== "openai" || openAiKey.length > 0,
    hint: "AI_PROVIDER=openai exige OPENAI_API_KEY.",
  },
];

for (const check of checks) {
  const icon = check.ok ? "OK" : "KO";
  console.log(`${icon} ${check.name}`);
  if (!check.ok) console.log(`   ${check.hint}`);
}

const failed = checks.filter((check) => !check.ok);

if (failed.length > 0) {
  console.log("");
  console.log("Configuration locale incomplete.");
  process.exit(1);
}

console.log("");
console.log("Configuration locale prête.");
