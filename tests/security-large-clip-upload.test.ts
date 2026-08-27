import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("le devis transmet seulement la durée et jamais le fichier audio", async () => {
  const component = await readFile(path.join(root, "app", "components", "SimpleClipCreator.tsx"), "utf8");
  const quoteBlock = component.slice(component.indexOf("const loadQuote"), component.indexOf("useEffect(() =>", component.indexOf("const loadQuote")));
  assert.match(quoteBlock, /audioDurationSeconds:\s*audioDuration/);
  assert.doesNotMatch(quoteBlock, /FormData|form\.set\("audio"/);
});

test("les gros fichiers utilisent un upload Blob privé lié à l’utilisateur", async () => {
  const component = await readFile(path.join(root, "app", "components", "SimpleClipCreator.tsx"), "utf8");
  const uploadRoute = await readFile(path.join(root, "app", "api", "simple-clips", "uploads", "route.ts"), "utf8");
  assert.doesNotMatch(component, /new FormData\(\)/);
  assert.match(component, /access:\s*"private"/);
  assert.match(component, /users\/\$\{user\.id\}\/simple-clips\/assets/);
  assert.match(uploadRoute, /getCurrentUser\(request\)/);
  assert.match(uploadRoute, /expectedPrefix = `rudyo-video-studio\/users\/\$\{user\.id\}/);
  assert.match(uploadRoute, /maximumSizeInBytes/);
});

test("la création revérifie propriétaire, taille et signature des blobs", async () => {
  const route = await readFile(path.join(root, "app", "api", "simple-clips", "route.ts"), "utf8");
  assert.match(route, /storageKeyFromClientRef/);
  assert.match(route, /expectedPrefix = `users\/\$\{user\.id\}\/simple-clips\/assets/);
  assert.match(route, /readStorageBuffer/);
  assert.match(route, /validateFileSize\(photoBuffer\.byteLength/);
  assert.match(route, /sniffMime\(photoBuffer\)[\s\S]*sniffMime\(audioBuffer\)/);
});
