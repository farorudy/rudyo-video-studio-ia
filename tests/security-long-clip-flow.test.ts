import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le navigateur ne transmet ni montant ni nombre de crédits à Stripe", async () => {
  const [creator, checkout] = await Promise.all([
    readFile(path.join(root, "app", "components", "SimpleClipCreator.tsx"), "utf8"),
    readFile(path.join(root, "app", "api", "billing", "create-checkout-session", "route.ts"), "utf8"),
  ]);
  assert.match(creator, /JSON\.stringify\(\{ mode: "clip_topup", projectId: draft\.projectId \}\)/);
  assert.doesNotMatch(creator, /clip_topup[\s\S]{0,120}(amount|tokens|credits):/);
  assert.match(checkout, /quoteClip\(project\.billedDurationSeconds/);
  assert.match(checkout, /calculateMissingClipCredits\(quote\.totalCredits, current\.creditsRemaining\)/);
  assert.match(checkout, /rudyo-clip-topup-\$\{user\.id\}-\$\{parsed\.data\.projectId\}/);
});

test("le projet privé est créé en brouillon avant le paiement", async () => {
  const route = await readFile(path.join(root, "app", "api", "simple-clips", "route.ts"), "utf8");
  assert.match(route, /status: "DRAFT"/);
  assert.match(route, /preparedProject = true/);
  assert.match(route, /intent === "prepare_only"/);
});

test("le webhook est signé, idempotent, crédite une fois et ne lance pas Seedance", async () => {
  const webhook = await readFile(path.join(root, "app", "api", "billing", "webhook", "route.ts"), "utf8");
  assert.match(webhook, /webhooks\.constructEvent\(body, signature, webhookSecret\)/);
  assert.match(webhook, /stripeSessionId: session\.id/);
  assert.match(webhook, /idempotencyKey: `stripe-session:\$\{session\.id\}`/);
  assert.match(webhook, /paymentCompletedAt: new Date\(\), status: "DRAFT"/);
  assert.doesNotMatch(webhook, /startPreparedSimpleClip|startSceneGeneration/);
});

test("la reprise exige un POST de confirmation explicite", async () => {
  const confirm = await readFile(path.join(root, "app", "api", "simple-clips", "[id]", "confirm", "route.ts"), "utf8");
  const creator = await readFile(path.join(root, "app", "components", "SimpleClipCreator.tsx"), "utf8");
  assert.match(confirm, /export async function POST/);
  assert.match(confirm, /startPreparedSimpleClip/);
  assert.match(creator, /Confirmer et générer mon clip/);
});
