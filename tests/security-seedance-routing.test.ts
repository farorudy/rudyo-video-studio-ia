import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("la route IA textuelle redirige Seedance avant tout fournisseur LLM", async () => {
  const source = await readFile(new URL("../app/api/ai/generate/route.ts", import.meta.url), "utf8");
  const guard = source.indexOf('tool === "seedance_video"');
  const llmCall = source.indexOf("await generateAI(prompt)");
  assert.ok(guard >= 0 && llmCall > guard);
});

test("Vercel Blob est privé par défaut", async () => {
  const source = await readFile(new URL("../lib/storage.ts", import.meta.url), "utf8");
  assert.match(source, /access:\s*"private"/);
  assert.doesNotMatch(source, /access:\s*options\.access\s*\?\?\s*"public"/);
});
