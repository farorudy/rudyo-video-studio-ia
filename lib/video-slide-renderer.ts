import sharp from "sharp";
import type { StoryboardPlan, StoryboardResult } from "@/lib/types";

export const SLIDE_WIDTH = 1920;
export const SLIDE_HEIGHT = 1080;

const SVG_FONT_FAMILY =
  '"Arial", "Segoe UI", "DejaVu Sans", "Noto Sans", "Liberation Sans", sans-serif';

type StoryboardPlanWithDialogue = StoryboardPlan & {
  dialogue?: string;
  objectif_pedagogique?: string;
  titre_etape?: string;
};

function normalizeText(value?: string | null) {
  return String(value ?? "")
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n+/g, " ")
    .trim();
}

export function sanitizeTextForSvg(value?: string | null) {
  return normalizeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function wrapText(text: string, maxChars: number, maxLines: number) {
  const normalized = normalizeText(text);
  const words = normalized.split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }

    if (lines.length === maxLines) {
      break;
    }
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  }

  if (normalized.length > lines.join(" ").length && lines.length > 0) {
    lines[lines.length - 1] = `${lines[lines.length - 1].replace(/\.*$/, "")}...`;
  }

  return lines.length > 0 ? lines : ["À compléter avec le contenu du storyboard."];
}

function svgTextBlock(
  lines: string[],
  x: number,
  y: number,
  options: {
    size: number;
    color: string;
    weight?: number;
    lineHeight?: number;
  },
) {
  const lineHeight = options.lineHeight ?? Math.round(options.size * 1.35);
  return lines
    .map(
      (line, index) =>
        `<text class="slide-text" x="${x}" y="${y + index * lineHeight}" fill="${options.color}" font-size="${options.size}" font-weight="${options.weight ?? 500}">${sanitizeTextForSvg(line)}</text>`,
    )
    .join("");
}

function pedagogicalDialogue(plan: StoryboardPlanWithDialogue) {
  const dialogue = normalizeText(plan.dialogue);
  if (dialogue) {
    return dialogue;
  }

  const description = normalizeText(plan.description);
  return `Conseiller : “Si je reformule, votre priorité est de ${description.toLowerCase()}.” Usager : “Oui, j’ai besoin d’un plan clair pour avancer.”`;
}

function pedagogicalObjective(plan: StoryboardPlanWithDialogue, index: number) {
  const objective = normalizeText(plan.objectif_pedagogique);
  if (objective) {
    return objective;
  }

  const defaults = [
    "Installer un cadre d’accueil rassurant et clarifier la demande de l’usager.",
    "Identifier les freins, les ressources et les attentes avec des questions ouvertes.",
    "Valoriser les compétences et construire un plan d’action réaliste.",
  ];

  return defaults[index] ?? "Transformer l’analyse de la situation en prochaine action concrète.";
}

function planTitle(plan: StoryboardPlanWithDialogue, index: number) {
  const explicit = normalizeText(plan.titre_etape || plan.texte_ecran);
  if (explicit) {
    return explicit;
  }

  const titles = [
    "Accueil et cadrage de l’entretien",
    "Analyse de la demande et des freins",
    "Valorisation des compétences et plan d’action",
  ];

  return titles[index] ?? `Étape pédagogique ${index + 1}`;
}

export function renderStoryboardSlideSvg(
  plan: StoryboardPlanWithDialogue,
  index: number,
  project: StoryboardResult,
) {
  const stepTitle = planTitle(plan, index);
  const description = normalizeText(plan.description || project.resume);
  const camera = normalizeText(plan.camera);
  const screenText = normalizeText(plan.texte_ecran);
  const transition = normalizeText(plan.transition);
  const dialogue = pedagogicalDialogue(plan);
  const objective = pedagogicalObjective(plan, index);

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" viewBox="0 0 ${SLIDE_WIDTH} ${SLIDE_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <style>
    .slide-text {
      font-family: ${SVG_FONT_FAMILY};
      text-rendering: geometricPrecision;
      dominant-baseline: alphabetic;
    }
  </style>
  <rect width="${SLIDE_WIDTH}" height="${SLIDE_HEIGHT}" fill="#020617"/>
  <rect x="72" y="58" width="1776" height="92" rx="20" fill="#0F172A"/>
  <rect x="96" y="88" width="10" height="34" rx="5" fill="#06B6D4"/>
  <text class="slide-text" x="126" y="113" fill="#CBD5E1" font-size="30" font-weight="700">Rudyo Video Studio IA — Formation CIP</text>
  <text class="slide-text" x="1510" y="113" fill="#10B981" font-size="30" font-weight="800">Plan ${index + 1}</text>

  <rect x="72" y="186" width="1776" height="758" rx="28" fill="#0F172A"/>
  <rect x="72" y="186" width="1776" height="8" fill="#06B6D4"/>
  <circle cx="1580" cy="276" r="122" fill="#06B6D4" opacity="0.10"/>
  <circle cx="1718" cy="762" r="154" fill="#10B981" opacity="0.09"/>

  <text class="slide-text" x="120" y="266" fill="#06B6D4" font-size="28" font-weight="800">Projet</text>
  ${svgTextBlock(wrapText(project.titre, 26, 3), 120, 318, {
    size: 48,
    color: "#FFFFFF",
    weight: 900,
    lineHeight: 58,
  })}

  <rect x="120" y="448" width="760" height="214" rx="20" fill="#020617" opacity="0.78"/>
  <text class="slide-text" x="154" y="504" fill="#10B981" font-size="28" font-weight="800">Objectif pédagogique</text>
  ${svgTextBlock(wrapText(objective, 50, 3), 154, 560, {
    size: 34,
    color: "#FFFFFF",
    weight: 700,
    lineHeight: 46,
  })}

  <rect x="920" y="270" width="860" height="392" rx="20" fill="#020617" opacity="0.78"/>
  <text class="slide-text" x="956" y="328" fill="#06B6D4" font-size="28" font-weight="800">${sanitizeTextForSvg(stepTitle)}</text>
  <text class="slide-text" x="956" y="388" fill="#CBD5E1" font-size="26" font-weight="700">Description visuelle</text>
  ${svgTextBlock(wrapText(description, 58, 4), 956, 438, {
    size: 30,
    color: "#FFFFFF",
    weight: 500,
    lineHeight: 42,
  })}

  <rect x="120" y="700" width="790" height="172" rx="20" fill="#020617" opacity="0.78"/>
  <text class="slide-text" x="154" y="754" fill="#06B6D4" font-size="26" font-weight="800">Dialogue conseillé</text>
  ${svgTextBlock(wrapText(dialogue, 58, 3), 154, 804, {
    size: 27,
    color: "#CBD5E1",
    weight: 600,
    lineHeight: 37,
  })}

  <rect x="950" y="700" width="830" height="172" rx="20" fill="#020617" opacity="0.78"/>
  <text class="slide-text" x="986" y="754" fill="#10B981" font-size="26" font-weight="800">Texte à l’écran</text>
  ${svgTextBlock(wrapText(screenText || stepTitle, 58, 2), 986, 804, {
    size: 30,
    color: "#FFFFFF",
    weight: 800,
    lineHeight: 42,
  })}
  <text class="slide-text" x="986" y="884" fill="#CBD5E1" font-size="24">Caméra : ${sanitizeTextForSvg(camera || "plan moyen, échange face à face")}</text>
  <text class="slide-text" x="986" y="920" fill="#CBD5E1" font-size="24">Transition : ${sanitizeTextForSvg(transition || "fondu sobre")}</text>

  <rect x="72" y="972" width="1776" height="58" rx="18" fill="#0F172A"/>
  <text class="slide-text" x="110" y="1010" fill="#CBD5E1" font-size="25" font-weight="700">Durée : ${sanitizeTextForSvg(plan.duree || "8 secondes")}</text>
  <text class="slide-text" x="1485" y="1010" fill="#10B981" font-size="25" font-weight="800">${sanitizeTextForSvg(plan.type_media)} · ${sanitizeTextForSvg(plan.statut)}</text>
</svg>`;
}

export async function renderStoryboardSlidePng(
  plan: StoryboardPlanWithDialogue,
  index: number,
  project: StoryboardResult,
  outputPath: string,
) {
  const svg = renderStoryboardSlideSvg(plan, index, project);

  await sharp(Buffer.from(svg, "utf8")).png().toFile(outputPath);
  return outputPath;
}
