import OpenAI from "openai";
import { Mistral } from "@mistralai/mistralai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

export async function generateWithOpenAI(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante.");
  }

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: prompt,
  });

  return response.output_text;
}

export async function generateWithMistral(prompt: string) {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY manquante.");
  }

  const response = await mistral.chat.complete({
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    return content.map((part: any) => part.text ?? "").join("\n");
  }

  return content ?? "";
}

export async function generateAI(prompt: string) {
  const provider = process.env.AI_PROVIDER || "openai";

  if (provider === "mistral") {
    const result = await generateWithMistral(prompt);

    return {
      provider,
      result,
    };
  }

  const result = await generateWithOpenAI(prompt);

  return {
    provider,
    result,
  };
}
