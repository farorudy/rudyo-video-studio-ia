import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { cancelGenerationTask, syncGenerationTask } from "@/lib/seedance/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const { id } = await params;
    const task = await syncGenerationTask(id, user.id);
    return NextResponse.json({ success: true, task, demo: task.provider === "byteplus-demo" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Suivi impossible." }, { status: 502 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  try {
    const { id } = await params;
    const task = await cancelGenerationTask(id, user.id);
    return NextResponse.json({ success: true, task });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Annulation impossible." }, { status: 409 });
  }
}

