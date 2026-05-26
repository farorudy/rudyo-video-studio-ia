import { Mistral } from "@mistralai/mistralai";
import { GenerateRequest, AIResponse, StoryboardJSON } from "../types";
import { getSystemPrompt, buildStoryboardPrompt } from "../prompt-templates";

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY,
});

export async function generateWithMistral(
  request: GenerateRequest,
): Promise<AIResponse> {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY not configured");
  }

  try {
    const systemPrompt = getSystemPrompt("sovereign");
    const userPrompt = buildStoryboardPrompt(request);

    const response = await mistral.chat.complete({
      model: process.env.MISTRAL_MODEL || "mistral-large-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS || "4096"),
      temperature: 0.7,
      responseFormat: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from Mistral");
    }

    const storyboard: StoryboardJSON = JSON.parse(content);
    storyboard.project.aiProvider = "mistral";

    return {
      success: true,
      mode: "sovereign",
      provider: "mistral",
      content: storyboard,
      tokensUsed: response.usage?.totalTokens,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Mistral generation failed: ${message}`);
  }
}
