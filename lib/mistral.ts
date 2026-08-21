import { Mistral } from "@mistralai/mistralai";

export async function generateWithMistral(prompt: string) {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    throw new Error("MISTRAL_API_KEY manquante");
  }

  const mistral = new Mistral({ apiKey });
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
