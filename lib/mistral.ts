import { Mistral } from "@mistralai/mistralai";

export const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

export async function generateWithMistral(prompt: string) {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY manquante");
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

  return response.choices?.[0]?.message?.content ?? "";
}
