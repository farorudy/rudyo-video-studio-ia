import { NextResponse } from "next/server";
import { readStorageBuffer } from "@/lib/storage";

export async function GET() {
  try {
    const buffer = await readStorageBuffer("export/thumbnail.jpg");

    if (!buffer) {
      throw new Error("Miniature introuvable");
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": buffer.byteLength.toString(),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Miniature non disponible." },
      { status: 404 },
    );
  }
}
