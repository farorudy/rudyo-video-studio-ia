import { handleOpenAiDiagnostic } from "@/lib/openai-diagnostic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function POST(request: Request) {
  return handleOpenAiDiagnostic(request);
}