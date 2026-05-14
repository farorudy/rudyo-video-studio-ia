import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    success: true,
    name: "rudyo-video-studio-ia",
    message: "MCP route active",
    endpoint: "/api/mcp",
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  return NextResponse.json({
    success: true,
    message: "MCP request received",
    received: body,
  });
}

export async function DELETE() {
  return NextResponse.json({
    success: true,
    message: "MCP session deleted",
  });
}
