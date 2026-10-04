import assert from "node:assert/strict";
import { handleOpenAiDiagnostic } from "../lib/openai-diagnostic.ts";

const adminToken = "test-only-admin-diagnostic-token-0123456789";
const env = {
  OPENAI_DIAGNOSTIC_ADMIN_TOKEN: adminToken,
  OPENAI_API_KEY: "test-only-openai-key",
  OPENAI_MODEL: "gpt-test-model",
  AI_PROVIDER: "mistral",
};

function request(token = adminToken, origin = "https://rudyoai.com") {
  return new Request("https://rudyoai.com/api/admin/openai-diagnostic", {
    method: "POST",
    headers: { origin, authorization: `Bearer ${token}` },
  });
}

let calls = 0;
const send = async (url, options) => {
  calls += 1;
  assert.equal(url, "https://api.openai.com/v1/chat/completions");
  assert.equal(options.signal.aborted, false);
  const body = JSON.parse(options.body);
  assert.equal(body.model, "gpt-test-model");
  assert.equal(body.max_completion_tokens, 8);
  assert.deepEqual(body.messages, [{ role: "user", content: "Réponds uniquement par OK." }]);
  return new Response(JSON.stringify({ model: "gpt-test-model", choices: [{ message: { content: "OK" } }], usage: { total_tokens: 4 } }));
};

let response = await handleOpenAiDiagnostic(request(), { env, send });
assert.equal(response.status, 200);
assert.deepEqual(await response.json(), { success: true, model: "gpt-test-model", answer: "OK", totalTokens: 4 });
assert.equal(calls, 1);

response = await handleOpenAiDiagnostic(request("bad-token"), { env, send });
assert.equal(response.status, 401);
assert.equal(calls, 1);

response = await handleOpenAiDiagnostic(request(adminToken, "https://evil.example"), { env, send });
assert.equal(response.status, 403);
assert.equal(calls, 1);

response = await handleOpenAiDiagnostic(request(), { env: { ...env, OPENAI_API_KEY: "" }, send });
assert.equal(response.status, 503);
assert.equal((await response.json()).error, "OPENAI_API_KEY_MISSING");

response = await handleOpenAiDiagnostic(request(), {
  env,
  send: async () => new Response("secret provider details", { status: 401 }),
});
assert.equal(response.status, 502);
const failure = await response.text();
assert.match(failure, /OPENAI_AUTH_FAILED/);
assert.ok(!failure.includes("secret provider details"));

response = await handleOpenAiDiagnostic(request(), { env, send });
assert.equal(response.status, 429);
assert.equal(calls, 1);

console.log("6 contrôles réussis : admin, origine, clé, modèle, erreur expurgée et limite de fréquence.");
