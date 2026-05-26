import { NextRequest, NextResponse } from "next/server";
import { generateStoryboard } from "@/lib/ai/generate";
import type { StoryboardGenerateRequest } from "@/lib/ai/generate";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body: StoryboardGenerateRequest = await request.json();

    // Validation
    if (!body.mode || !body.contentType || !body.topic) {
      return NextResponse.json(
        {
          error: "Invalid request",
          details: "mode, contentType, and topic are required",
        },
        { status: 400 },
      );
    }

    if (!["creative", "expert", "sovereign"].includes(body.mode)) {
      return NextResponse.json(
        {
          error: "Invalid mode",
          validModes: ["creative", "expert", "sovereign"],
        },
        { status: 400 },
      );
    }

    if (
      !["storyboard", "script", "prompt", "project"].includes(body.contentType)
    ) {
      return NextResponse.json(
        {
          error: "Invalid contentType",
          validTypes: ["storyboard", "script", "prompt", "project"],
        },
        { status: 400 },
      );
    }

    console.log(`[API] Storyboard generation requested:`, {
      mode: body.mode,
      contentType: body.contentType,
      topic: body.topic,
    });

    const result = await generateStoryboard(body);

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("[API] Storyboard generation failed:", error);

    return NextResponse.json(
      {
        error: "Generation failed",
        message: errorMessage,
      },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: "Storyboard generation API",
    method: "POST",
    modes: ["creative", "expert", "sovereign"],
    contentTypes: ["storyboard", "script", "prompt", "project"],
  });
}
