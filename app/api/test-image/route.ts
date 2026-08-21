import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enforceApiRateLimit, withTimeout } from "@/lib/request-security";

function buildFallbackSvg(prompt: string, width: string, height: string) {
  const escapedPrompt = prompt
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .slice(0, 120);

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#052e16" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#bg)" rx="24" />
      <text x="50%" y="42%" text-anchor="middle" fill="#34d399" font-family="Arial, sans-serif" font-size="28" font-weight="700">
        Aperçu test local
      </text>
      <text x="50%" y="52%" text-anchor="middle" fill="#e2e8f0" font-family="Arial, sans-serif" font-size="18">
        Pollinations indisponible
      </text>
      <foreignObject x="12%" y="60%" width="76%" height="22%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font-family:Arial,sans-serif;font-size:16px;line-height:1.4;text-align:center;">
          ${escapedPrompt}
        </div>
      </foreignObject>
    </svg>
  `.trim();
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser(req);
  if (!user || user.localSession) {
    return NextResponse.json({ success: false, error: "Authentification vérifiée requise." }, { status: 401 });
  }
  try {
    await enforceApiRateLimit(req, "test-image", user.id, 10, 60_000);
  } catch {
    return NextResponse.json({ success: false, error: "Trop de requêtes." }, { status: 429 });
  }

  const prompt = req.nextUrl.searchParams.get("prompt")?.trim();
  const widthNumber = Number(req.nextUrl.searchParams.get("width") || 1280);
  const heightNumber = Number(req.nextUrl.searchParams.get("height") || 720);
  const seedNumber = Number(req.nextUrl.searchParams.get("seed") || 1);

  if (
    !prompt || prompt.length > 2_000 ||
    !Number.isInteger(widthNumber) || widthNumber < 256 || widthNumber > 1920 ||
    !Number.isInteger(heightNumber) || heightNumber < 256 || heightNumber > 1080 ||
    !Number.isInteger(seedNumber) || seedNumber < 0 || seedNumber > 2_147_483_647
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Le prompt image est obligatoire.",
      },
      { status: 400 },
    );
  }
  const width = String(widthNumber);
  const height = String(heightNumber);
  const seed = String(seedNumber);

  const upstreamUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${encodeURIComponent(width)}` +
    `&height=${encodeURIComponent(height)}` +
    `&seed=${encodeURIComponent(seed)}` +
    "&nologo=true";

  try {
    const response = await withTimeout(
      fetch(upstreamUrl, { cache: "no-store" }),
      15_000,
      "Le service d’image a expiré.",
    );

    if (!response.ok) {
      throw new Error(`Pollinations indisponible (${response.status}).`);
    }

    const declared = Number(response.headers.get("content-length") || 0);
    if (declared > 10 * 1024 * 1024) throw new Error("Image trop volumineuse.");
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > 10 * 1024 * 1024) throw new Error("Image trop volumineuse.");

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": response.headers.get("content-type") || "image/jpeg",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch {
    const svg = buildFallbackSvg(prompt, width, height);

    return new NextResponse(svg, {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
}
