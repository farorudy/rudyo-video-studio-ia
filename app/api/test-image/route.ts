import { NextRequest, NextResponse } from "next/server";

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
  const prompt = req.nextUrl.searchParams.get("prompt")?.trim();
  const width = req.nextUrl.searchParams.get("width")?.trim() || "1280";
  const height = req.nextUrl.searchParams.get("height")?.trim() || "720";
  const seed = req.nextUrl.searchParams.get("seed")?.trim() || "1";

  if (!prompt) {
    return NextResponse.json(
      {
        success: false,
        error: "Le prompt image est obligatoire.",
      },
      { status: 400 },
    );
  }

  const upstreamUrl =
    `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}` +
    `?width=${encodeURIComponent(width)}` +
    `&height=${encodeURIComponent(height)}` +
    `&seed=${encodeURIComponent(seed)}` +
    "&nologo=true";

  try {
    const response = await fetch(upstreamUrl, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Pollinations indisponible (${response.status}).`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());

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
