import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { buildOpeningShotRanges, buildStructuredScenario, validateScenarioQuality } from "../lib/scenario-studio";
import { buildTikTokScenes } from "../lib/tiktok-offer";

const root = path.resolve(import.meta.dirname, "..");

function scenarioFor(seconds = 15) {
  const legacy = buildTikTokScenes(seconds, "Une artiste traverse une ville nocturne avant de monter sur scène.", "Cinéma élégant");
  return buildStructuredScenario({
    title: "Clip test",
    idea: "Une artiste traverse une ville nocturne avant de monter sur scène.",
    style: "Cinéma élégant et lumière nocturne cohérente",
    audioDurationMs: seconds * 1000,
    shots: legacy.map((shot, index) => ({
      id: `legacy-${index}`, order: shot.order, title: shot.title,
      startTimeSeconds: shot.startTimeSeconds, endTimeSeconds: shot.endTimeSeconds,
      prompt: shot.prompt, description: shot.description, cameraMovement: shot.cameraMovement,
      lighting: shot.lighting, transition: shot.transition, continuityNotes: shot.continuityNotes,
    })),
  });
}

test("la scène d'ouverture 0–14,85 est divisée aux timecodes exacts", () => {
  const shots = buildOpeningShotRanges(14_850);
  assert.deepEqual(shots.map((shot) => [shot.startMs, shot.endMs]), [[0, 4000], [4000, 8500], [8500, 12000], [12000, 14850]]);
  assert.equal(shots[3].syncCueMs, 12_888);
});

test("la chronologie structurée accepte toutes les durées commerciales", () => {
  for (const seconds of [15, 210, 240, 276, 300, 420]) {
    const scenario = scenarioFor(seconds);
    assert.equal(scenario.audioDurationMs, seconds * 1000);
    assert.equal(scenario.scenes[0].startMs, 0);
    assert.equal(scenario.scenes.at(-1)?.endMs, seconds * 1000);
    assert.deepEqual(validateScenarioQuality(scenario), []);
  }
});

test("les trous et chevauchements sont détectés", () => {
  const scenario = scenarioFor();
  scenario.scenes[0].shots[0].endMs -= 1;
  assert.ok(validateScenarioQuality(scenario).some((issue) => issue.code === "SHOT_TIMELINE" || issue.code === "SHOT_COVERAGE"));
});

test("les mentions svg et Developpersvg sont rejetées", () => {
  for (const parasite of ["svg", "Developpersvg"]) {
    const scenario = scenarioFor();
    scenario.scenes[0].shots[0].seedancePrompt += ` ${parasite}`;
    assert.ok(validateScenarioQuality(scenario).some((issue) => issue.code === "PARASITE_TEXT"));
  }
});

test("un scénario trop répétitif est rejeté", () => {
  const scenario = scenarioFor(60);
  const repeated = scenario.scenes[0].shots[0].seedancePrompt;
  scenario.scenes.forEach((scene) => scene.shots.forEach((shot) => { shot.seedancePrompt = repeated; }));
  assert.ok(validateScenarioQuality(scenario).some((issue) => issue.code === "PROMPTS_REPETITIVE"));
});

test("la contradiction entre aucun personnage et une distribution est détectée", () => {
  const scenario = scenarioFor();
  scenario.scenes[0].narrativeContent = "Aucun personnage ne figure dans ce récit, seulement le décor et la lumière pendant toute cette séquence musicale.";
  assert.ok(validateScenarioQuality(scenario).some((issue) => issue.code === "CAST_CONTRADICTION"));
});

test("la persistance précède la construction et la génération payante exige la validation", async () => {
  const service = await readFile(path.join(root, "lib", "scenario-studio-service.ts"), "utf8");
  assert.ok(service.indexOf("prisma.scenarioVersion.create") < service.indexOf("const structure = buildStructuredScenario"));
  const production = await readFile(path.join(root, "lib", "simple-clip-production.ts"), "utf8");
  assert.match(production, /status:\s*"VALIDATED"/);
  assert.ok(production.indexOf("SCENARIO_VALIDATION_REQUIRED") < production.indexOf("reserveCredits({"));
  assert.match(production, /scenarioContentHash/);
});

test("une modification produit une nouvelle version et conserve les précédentes", async () => {
  const actions = await readFile(path.join(root, "app", "projects", "[projectId]", "storyboard", "actions.ts"), "utf8");
  const service = await readFile(path.join(root, "lib", "scenario-studio-service.ts"), "utf8");
  assert.match(actions, /createScenarioVersionFromLegacyProject/);
  assert.match(service, /status:\s*ScenarioVersionStatus\.SUPERSEDED/);
  assert.doesNotMatch(service, /scenarioVersion\.deleteMany/);
});

test("la modale et la grille Croquis restent accessibles et responsives", async () => {
  const modal = await readFile(path.join(root, "app", "components", "RouteModal.tsx"), "utf8");
  const studio = await readFile(path.join(root, "app", "components", "StoryboardStudio.tsx"), "utf8");
  assert.match(modal, /aria-modal="true"/);
  assert.match(modal, /event\.key === "Escape"/);
  assert.match(modal, /router\.back\(\)/);
  assert.match(studio, /md:grid-cols-2/);
  assert.match(studio, /next\/image/);
  assert.match(studio, /Les croquis aident à comprendre/);
});

test("les anciens liens de scénario entrent dans le Studio Storyboard", async () => {
  const [listRoute, detailRoute, entryPage] = await Promise.all([
    readFile(path.join(root, "app", "api", "simple-clips", "route.ts"), "utf8"),
    readFile(path.join(root, "app", "api", "simple-clips", "[id]", "route.ts"), "utf8"),
    readFile(path.join(root, "app", "projects", "[projectId]", "storyboard", "page.tsx"), "utf8"),
  ]);
  assert.doesNotMatch(listRoute, /scenarioUrl:.*\/api\/projects\/.*\/scenario/);
  assert.match(listRoute, /scenarioUrl:.*\/projects\/.*\/storyboard/);
  assert.match(detailRoute, /storyboardUrl:.*\/projects\/.*\/storyboard/);
  assert.match(entryPage, /createScenarioVersionFromLegacyProject/);
  assert.match(entryPage, /redirect\(`\/projects\/\$\{encodeURIComponent\(projectId\)\}\/storyboard\//);
});
