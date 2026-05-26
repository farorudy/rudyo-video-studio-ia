import OpenAI from "openai";
import { GenerateRequest, AIResponse, StoryboardJSON } from "../types";
import { getSystemPrompt, buildStoryboardPrompt } from "../prompt-templates";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateWithOpenAI(
  request: GenerateRequest,
): Promise<AIResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY not configured");
  }

  try {
    const systemPrompt = getSystemPrompt("creative");
    const userPrompt = buildStoryboardPrompt(request);

    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "4096"),
      temperature: 0.8,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const storyboard: StoryboardJSON = JSON.parse(content);
    storyboard.project.aiProvider = "openai";

    return {
      success: true,
      mode: "creative",
      provider: "openai",
      content: storyboard,
      tokensUsed: response.usage?.total_tokens,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`OpenAI generation failed: ${message}`);
  }
}
