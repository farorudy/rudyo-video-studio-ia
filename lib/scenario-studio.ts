import { createHash } from "node:crypto";
import { z } from "zod";

const referenceKeysSchema = {
  castKeys: z.array(z.string()),
  locationKeys: z.array(z.string()),
  propKeys: z.array(z.string()),
};

export const scenarioShotSchema = z.object({
  position: z.number().int().positive(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  shotFunction: z.string().min(20),
  startFrame: z.string().min(40),
  actionAndCamera: z.string().min(40),
  environmentalDynamics: z.string().min(20),
  endFrame: z.string().min(20),
  seedancePrompt: z.string().min(80),
  cameraMovement: z.string().min(3),
  ...referenceKeysSchema,
});

export const scenarioSceneSchema = z.object({
  position: z.number().int().positive(),
  title: z.string().min(3),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().positive(),
  narrativeContent: z.string().min(60),
  emotionalArc: z.string().min(10),
  soundVibe: z.string().min(10),
  contextualPosition: z.string().min(10),
  pacing: z.string().min(5),
  transitionOut: z.string().min(10),
  shots: z.array(scenarioShotSchema).min(1),
});

export const generatedScenarioSchema = z.object({
  title: z.string().min(1),
  audioDurationMs: z.number().int().positive(),
  visualBible: z.object({
    palette: z.array(z.string()).min(3),
    style: z.string().min(20),
    aspectRatio: z.literal("9:16"),
    cast: z.array(z.object({ key: z.string(), description: z.string() })),
    locations: z.array(z.object({ key: z.string(), description: z.string() })),
    props: z.array(z.object({ key: z.string(), description: z.string() })),
  }),
  scenes: z.array(scenarioSceneSchema).min(1),
});

export type GeneratedScenario = z.infer<typeof generatedScenarioSchema>;

export type LegacyScenarioShot = {
  id: string;
  order: number;
  title: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  prompt: string;
  description: string | null;
  cameraMovement: string | null;
  lighting: string | null;
  transition?: string | null;
  continuityNotes: string | null;
};

export type ScenarioQualityIssue = { code: string; message: string; scenePosition?: number; shotPosition?: number };

const bannedInterfaceText = /(?:developpersvg|\bsvg\b|bouton|interface utilisateur)/iu;
const noCharacter = /aucun(?:e)? personnage|sans personnage/iu;

export function stableScenarioHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/** Exemple de référence demandé dans le brief, conservé en millisecondes exactes. */
export function buildOpeningShotRanges(durationMs: number) {
  if (durationMs !== 14_850) throw new Error("OPENING_EXAMPLE_DURATION_UNSUPPORTED");
  return [
    { position: 1, startMs: 0, endMs: 4_000, cue: "Rue pavée, brume et réverbères" },
    { position: 2, startMs: 4_000, endMs: 8_500, cue: "Révélation du Club Bèlè" },
    { position: 3, startMs: 8_500, endMs: 12_000, cue: "Cadillac en approche" },
    { position: 4, startMs: 12_000, endMs: 14_850, cue: "Reflets et goutte de pluie", syncCueMs: 12_888 },
  ];
}

function sceneLabel(index: number, count: number) {
  if (index === 0) return "Ouverture";
  if (index === count - 1) return "Conclusion";
  const labels = ["Couplet", "Montée", "Refrain", "Respiration", "Pont"];
  return labels[(index - 1) % labels.length];
}

export function buildStructuredScenario(input: {
  title: string;
  idea: string;
  style?: string | null;
  audioDurationMs: number;
  shots: LegacyScenarioShot[];
}): GeneratedScenario {
  if (!input.shots.length) throw new Error("SCENARIO_MISSING");
  const sceneCount = Math.max(1, Math.min(8, Math.ceil(input.audioDurationMs / 30_000)));
  const buckets = Array.from({ length: sceneCount }, () => [] as LegacyScenarioShot[]);
  for (const shot of input.shots) {
    const midpoint = ((shot.startTimeSeconds + shot.endTimeSeconds) * 500);
    const index = Math.min(sceneCount - 1, Math.floor((midpoint / input.audioDurationMs) * sceneCount));
    buckets[index].push(shot);
  }
  const populated = buckets.filter((bucket) => bucket.length > 0);
  const castKey = "artiste-principal";
  const locationKey = "univers-principal";
  const style = input.style?.trim() || "Cinéma musical contemporain, vertical et cohérent avec la photographie de référence";
  const scenes = populated.map((bucket, sceneIndex) => {
    const label = sceneLabel(sceneIndex, populated.length);
    const shots = bucket.map((shot, shotIndex) => ({
      position: shotIndex + 1,
      startMs: Math.round(shot.startTimeSeconds * 1000),
      endMs: Math.round(shot.endTimeSeconds * 1000),
      shotFunction: `${shot.title} fait progresser clairement le récit musical et son énergie.`,
      startFrame: `L'image débute dans ${shot.description || "le décor principal"}, avec une composition lisible et la continuité du plan précédent.`,
      actionAndCamera: `${shot.prompt} Mouvement caméra prévu : ${shot.cameraMovement || "travelling fluide et stabilisé"}.`,
      environmentalDynamics: `La lumière, l'air et les éléments du décor réagissent naturellement au rythme musical.`,
      endFrame: `Le plan se termine sur une image raccordable qui prépare la transition narrative suivante.`,
      seedancePrompt: `${shot.prompt} Plan ${shot.order + 1}, timecode exact ${shot.startTimeSeconds.toFixed(3)} à ${shot.endTimeSeconds.toFixed(3)} secondes. Préserver le visage, la tenue, la palette, la lumière et le décor de façon cohérente.`,
      cameraMovement: shot.cameraMovement || "travelling fluide",
      castKeys: [castKey],
      locationKeys: [locationKey],
      propKeys: [],
    }));
    return {
      position: sceneIndex + 1,
      title: `${label} — ${bucket[0].title.replace(/^Clip automatique\s*·?\s*/u, "")}`,
      startMs: shots[0].startMs,
      endMs: shots.at(-1)!.endMs,
      narrativeContent: `${label} du clip : ${input.idea.trim()} Cette partie organise ${shots.length} plan${shots.length > 1 ? "s" : ""} pour faire avancer l'histoire avec une intention claire et compréhensible.`,
      emotionalArc: sceneIndex === 0 ? "Curiosité puis révélation progressive" : sceneIndex === populated.length - 1 ? "Résolution et émotion finale" : "Intensité musicale en progression",
      soundVibe: "Synchronisation avec le rythme, les accents et l'énergie de la musique",
      contextualPosition: `${sceneIndex + 1}e passage narratif sur ${populated.length} dans la structure complète`,
      pacing: shots.length > 2 ? "Soutenu" : "Mesuré",
      transitionOut: bucket.at(-1)?.transition || (sceneIndex === populated.length - 1 ? "Fondu final vers le noir" : "Raccord de mouvement vers la scène suivante"),
      shots,
    };
  });
  return generatedScenarioSchema.parse({
    title: input.title,
    audioDurationMs: input.audioDurationMs,
    visualBible: {
      palette: ["cyan nocturne", "ambre chaud", "noir profond"],
      style,
      aspectRatio: "9:16",
      cast: [{ key: castKey, description: "Artiste principal conforme à la photographie de référence, visage et tenue stables" }],
      locations: [{ key: locationKey, description: "Univers visuel principal du clip, cohérent d'un plan à l'autre" }],
      props: [],
    },
    scenes,
  });
}

export function validateScenarioQuality(scenario: GeneratedScenario): ScenarioQualityIssue[] {
  const issues: ScenarioQualityIssue[] = [];
  const refs = new Set([
    ...scenario.visualBible.cast.map((item) => item.key),
    ...scenario.visualBible.locations.map((item) => item.key),
    ...scenario.visualBible.props.map((item) => item.key),
  ]);
  let sceneCursor = 0;
  const prompts: string[] = [];
  scenario.scenes.forEach((scene, sceneIndex) => {
    if (scene.position !== sceneIndex + 1 || scene.startMs !== sceneCursor || scene.endMs <= scene.startMs) issues.push({ code: "SCENE_TIMELINE", message: "Les scènes doivent se suivre sans trou ni chevauchement.", scenePosition: scene.position });
    let shotCursor = scene.startMs;
    scene.shots.forEach((shot, shotIndex) => {
      if (shot.position !== shotIndex + 1 || shot.startMs !== shotCursor || shot.endMs <= shot.startMs || shot.endMs > scene.endMs) issues.push({ code: "SHOT_TIMELINE", message: "Un plan est mal placé dans sa scène.", scenePosition: scene.position, shotPosition: shot.position });
      const text = [shot.shotFunction, shot.startFrame, shot.actionAndCamera, shot.environmentalDynamics, shot.endFrame, shot.seedancePrompt, shot.cameraMovement].join(" ");
      if (bannedInterfaceText.test(text)) issues.push({ code: "PARASITE_TEXT", message: "Le plan contient une instruction d'interface parasite.", scenePosition: scene.position, shotPosition: shot.position });
      for (const key of [...shot.castKeys, ...shot.locationKeys, ...shot.propKeys]) if (!refs.has(key)) issues.push({ code: "UNKNOWN_REFERENCE", message: `La référence « ${key} » n'existe pas.`, scenePosition: scene.position, shotPosition: shot.position });
      prompts.push(shot.seedancePrompt.trim().toLocaleLowerCase("fr"));
      shotCursor = shot.endMs;
    });
    if (shotCursor !== scene.endMs) issues.push({ code: "SHOT_COVERAGE", message: "Les plans ne couvrent pas toute la scène.", scenePosition: scene.position });
    sceneCursor = scene.endMs;
  });
  if (scenario.scenes[0]?.startMs !== 0 || sceneCursor !== scenario.audioDurationMs) issues.push({ code: "TOTAL_COVERAGE", message: "Le scénario doit couvrir exactement toute la musique." });
  const uniqueRatio = prompts.length ? new Set(prompts).size / prompts.length : 0;
  if (uniqueRatio < 0.75) issues.push({ code: "PROMPTS_REPETITIVE", message: "Les prompts des plans sont trop répétitifs." });
  if (noCharacter.test(scenario.scenes.map((scene) => scene.narrativeContent).join(" ")) && scenario.visualBible.cast.length) issues.push({ code: "CAST_CONTRADICTION", message: "Le récit annonce aucun personnage alors qu'une distribution est définie." });
  return issues;
}
