const key = process.env.STRIPE_SECRET_KEY || "";
const stripeMode = key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "invalid";
const required = ["DATABASE_URL", "ARK_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "BLOB_READ_WRITE_TOKEN", "BYTEPLUS_ENABLED_MODELS", "TIKTOK_SEEDANCE_MODEL_ID", "TIKTOK_PROVIDER_COST_EUR_PER_SECOND"];
console.log(JSON.stringify({ stripeMode, variables: Object.fromEntries(required.map((name) => [name, Boolean(process.env[name] && !process.env[name].startsWith("@"))])) }));
