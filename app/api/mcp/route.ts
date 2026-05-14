import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    success: true,
    name: "Rudyo Video Studio IA MCP",
    message: "MCP route active",
    status: "ok",
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    return NextResponse.json({
      success: true,
      message: "MCP request received",
      received: body,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid MCP request",
      },
      { status: 400 },
    );
  }
}
