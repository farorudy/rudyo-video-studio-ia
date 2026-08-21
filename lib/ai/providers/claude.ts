import Anthropic from "@anthropic-ai/sdk";
import { GenerateRequest, AIResponse, StoryboardJSON } from "../types";
import { getSystemPrompt, buildStoryboardPrompt } from "../prompt-templates";

export async function generateWithClaude(
  request: GenerateRequest,
): Promise<AIResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const systemPrompt = getSystemPrompt("expert");
    const userPrompt = buildStoryboardPrompt(request);

    const response = await anthropic.messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
      max_tokens: parseInt(process.env.ANTHROPIC_MAX_TOKENS || "4096"),
      messages: [
        {
          role: "user",
          content: `${systemPrompt}\n\n${userPrompt}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response type from Claude");
    }

    const storyboard: StoryboardJSON = JSON.parse(content.text);
    storyboard.project.aiProvider = "claude";

    return {
      success: true,
      mode: "expert",
      provider: "claude",
      content: storyboard,
      tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Claude generation failed: ${message}`);
  }
}
