import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
const fixtures = [
  { file: "audio-15s.m4a", plan: "TIKTOK", normalized: 15, credits: 3_500, refusal: null },
  { file: "audio-3m30.m4a", plan: "TIKTOK", normalized: 210, credits: 3_500, refusal: null },
  { file: "audio-5m.m4a", plan: "LONG", normalized: 300, credits: 5_000, refusal: null },
  { file: "audio-7m.m4a", plan: "PREMIUM", normalized: 420, credits: 7_000, refusal: null },
  { file: "audio-7m01.m4a", plan: "PREMIUM", normalized: 421, credits: 0, refusal: "DURATION_TOO_LONG" },
];

const results = [];
for (const fixture of fixtures) {
  const form = new FormData();
  const buffer = await readFile(path.resolve("media", "local-test-fixtures", fixture.file));
  form.set("audio", new File([buffer], fixture.file, { type: "audio/mp4" }));
  form.set("audioStartSeconds", "0");
  form.set("plan", fixture.plan);
  const response = await fetch(`${baseURL}/api/simple-clips/quote`, { method: "POST", body: form });
  assert.equal(response.status, 200);
  const quote = await response.json();
  assert.equal(quote.normalizedSeconds, fixture.normalized);
  assert.equal(quote.totalCredits, fixture.credits);
  assert.equal(quote.refusalCode, fixture.refusal);
  results.push({ file: fixture.file, normalizedSeconds: quote.normalizedSeconds, credits: quote.totalCredits, plan: quote.plan, supported: quote.supported, refusalCode: quote.refusalCode, workerAvailable: quote.workerAvailable });
}
console.log(JSON.stringify(results));
