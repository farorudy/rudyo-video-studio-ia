import { handleTutor } from "@/lib/cipfaro-tutor";
export const runtime = "nodejs";
export const maxDuration = 90;
export async function POST(request: Request) { return handleTutor(request); }
export async function OPTIONS(request: Request) { return handleTutor(request); }
