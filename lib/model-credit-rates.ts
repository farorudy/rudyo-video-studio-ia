export type ModelCreditUnit =
  | "per image"
  | "per second"
  | "per request"
  | "per shot";

export type ModelCreditCategory =
  | "Text to Image"
  | "Image to Video"
  | "Avatar"
  | "Audio"
  | "Video Analysis"
  | "Audio Analysis";

export type ModelCreditRate = {
  category: ModelCreditCategory;
  model: string;
  resolution: string;
  credits: number;
  unit: ModelCreditUnit;
  requirement: string;
};

export const MODEL_CREDIT_CATEGORY_LABELS: Record<ModelCreditCategory, string> =
  {
    "Text to Image": "Texte vers image",
    "Image to Video": "Image vers video",
    Avatar: "Avatar",
    Audio: "Audio",
    "Video Analysis": "Analyse video",
    "Audio Analysis": "Analyse audio",
  };

export const MODEL_CREDIT_RATES: ModelCreditRate[] = [
  {
    category: "Text to Image",
    model: "Midjourney V7",
    resolution: "Any",
    credits: 9,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Nano Banana",
    resolution: "Any",
    credits: 4,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Nano Banana 2",
    resolution: "1K",
    credits: 8,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Nano Banana Pro",
    resolution: "1080P/2K",
    credits: 14,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Seedream 4.5",
    resolution: "Any",
    credits: 4,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Seedream 5.0 Lite",
    resolution: "Any",
    credits: 4,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Grok Imagine Image",
    resolution: "Any",
    credits: 2,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "GPT Image 2.0",
    resolution: "1080P",
    credits: 16,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Flux.2",
    resolution: "720P",
    credits: 3,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Text to Image",
    model: "Flux.2-Pro",
    resolution: "Any",
    credits: 6,
    unit: "per image",
    requirement: "-",
  },
  {
    category: "Image to Video",
    model: "Magi-1.1",
    resolution: "720P",
    credits: 4,
    unit: "per second",
    requirement: "1s minimum",
  },
  ...SEEDANCE_DEFAULT_CREDIT_RATES.map((rate) => ({
    category: "Image to Video" as const,
    model: rate.label,
    resolution: rate.resolution.toUpperCase(),
    credits: rate.creditsPerSecond,
    unit: "per second" as const,
    requirement: "4s minimum",
  })),
  {
    category: "Image to Video",
    model: "Seedance 1.5 Pro",
    resolution: "720P",
    credits: 6,
    unit: "per second",
    requirement: "4s minimum",
  },
  {
    category: "Image to Video",
    model: "Seedance 1.0 Pro Fast",
    resolution: "720P",
    credits: 3,
    unit: "per second",
    requirement: "3s minimum",
  },
  {
    category: "Image to Video",
    model: "Seedance 1.0 Pro Fast",
    resolution: "1080P",
    credits: 5,
    unit: "per second",
    requirement: "3s minimum",
  },
  {
    category: "Image to Video",
    model: "Kling V3.0 Pro",
    resolution: "1080P, 720P",
    credits: 23,
    unit: "per second",
    requirement: "3s minimum",
  },
  {
    category: "Image to Video",
    model: "Kling O1",
    resolution: "1080P, 720P",
    credits: 12,
    unit: "per second",
    requirement: "3s minimum",
  },
  {
    category: "Image to Video",
    model: "Kling V2.6 Pro",
    resolution: "1080P",
    credits: 14,
    unit: "per second",
    requirement: "5s minimum",
  },
  {
    category: "Image to Video",
    model: "Veo 3",
    resolution: "1080P, 720P",
    credits: 40,
    unit: "per second",
    requirement: "8s minimum",
  },
  {
    category: "Image to Video",
    model: "Veo 3 Fast",
    resolution: "1080P, 720P",
    credits: 15,
    unit: "per second",
    requirement: "4s minimum",
  },
  {
    category: "Image to Video",
    model: "Veo 3.1",
    resolution: "1080P, 720P",
    credits: 40,
    unit: "per second",
    requirement: "4s minimum",
  },
  {
    category: "Image to Video",
    model: "Grok Imagine Video",
    resolution: "720P",
    credits: 7,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Image to Video",
    model: "Hailuo 2.3 Pro Fast",
    resolution: "1080P",
    credits: 6,
    unit: "per second",
    requirement: "6s minimum",
  },
  {
    category: "Image to Video",
    model: "Hailuo 2.3 Pro",
    resolution: "1080P",
    credits: 9,
    unit: "per second",
    requirement: "6s minimum",
  },
  {
    category: "Image to Video",
    model: "Hailuo 2.3 Standard",
    resolution: "768P",
    credits: 5,
    unit: "per second",
    requirement: "6s minimum",
  },
  {
    category: "Image to Video",
    model: "Vidu Q3",
    resolution: "1080P, 720P",
    credits: 16,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Image to Video",
    model: "Pixverse V6",
    resolution: "720P",
    credits: 5,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Image to Video",
    model: "Pixverse V6",
    resolution: "1080P",
    credits: 9,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Image to Video",
    model: "Vidu Q2",
    resolution: "720P",
    credits: 10,
    unit: "per second",
    requirement: "2s minimum",
  },
  {
    category: "Image to Video",
    model: "Vidu Q2",
    resolution: "1080P",
    credits: 20,
    unit: "per second",
    requirement: "2s minimum",
  },
  {
    category: "Image to Video",
    model: "Wan V2.6",
    resolution: "720P",
    credits: 10,
    unit: "per second",
    requirement: "5s minimum",
  },
  {
    category: "Image to Video",
    model: "Wan V2.6",
    resolution: "1080P",
    credits: 15,
    unit: "per second",
    requirement: "5s minimum",
  },
  {
    category: "Avatar",
    model: "Kling AI Avatar v2 Pro",
    resolution: "-",
    credits: 12,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Avatar",
    model: "Gaga Avatar V2",
    resolution: "720P",
    credits: 4,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Avatar",
    model: "Omnihuman V1.5",
    resolution: "-",
    credits: 16,
    unit: "per second",
    requirement: "1s minimum",
  },
  {
    category: "Audio",
    model: "Suno Music V5",
    resolution: "-",
    credits: 6,
    unit: "per request",
    requirement: "1 song",
  },
  {
    category: "Audio",
    model: "ElevenLabs Music",
    resolution: "-",
    credits: 1,
    unit: "per second",
    requirement: "1 second",
  },
  {
    category: "Audio",
    model: "ElevenLabs Text-to-speech",
    resolution: "-",
    credits: 1,
    unit: "per second",
    requirement: "1 second",
  },
  {
    category: "Audio",
    model: "MiniMax Text-to-speech",
    resolution: "-",
    credits: 1,
    unit: "per second",
    requirement: "1 second",
  },
  {
    category: "Audio",
    model: "Index Text-to-speech2",
    resolution: "-",
    credits: 1,
    unit: "per second",
    requirement: "1 second",
  },
  {
    category: "Video Analysis",
    model: "VidMuse feature",
    resolution: "Any",
    credits: 3,
    unit: "per shot",
    requirement: "-",
  },
  {
    category: "Audio Analysis",
    model: "VidMuse feature",
    resolution: "-",
    credits: 1,
    unit: "per second",
    requirement: "-",
  },
];

export const MODEL_CREDIT_CATEGORIES: ModelCreditCategory[] = [
  "Text to Image",
  "Image to Video",
  "Avatar",
  "Audio",
  "Video Analysis",
  "Audio Analysis",
];

export function getModelCreditRatesByCategory(category: ModelCreditCategory) {
  return MODEL_CREDIT_RATES.filter((rate) => rate.category === category);
}
import { SEEDANCE_DEFAULT_CREDIT_RATES } from "@/lib/seedance/pricing";
