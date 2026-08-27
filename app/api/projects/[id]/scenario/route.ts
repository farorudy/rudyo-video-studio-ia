import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateClipScenario } from "@/lib/tiktok-offer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const project = await prisma.videoProject.findFirst({
    where: { id, userId: user.id },
    include: { scenes: { orderBy: { order: "asc" } } },
  });
  if (!project) return NextResponse.json({ error: "Projet introuvable." }, { status: 404 });
  const duration = project.billedDurationSeconds || project.durationSeconds || 0;
  let valid = false;
  try { validateClipScenario(project.scenes, duration); valid = true; } catch { valid = false; }
  const rows = project.scenes.map((scene) => `<article>
    <h2>Plan ${scene.order} — ${escapeHtml(scene.title)}</h2>
    <p class="time">${scene.startTimeSeconds.toFixed(1)} s → ${scene.endTimeSeconds.toFixed(1)} s · ${scene.durationSeconds} s</p>
    <p>${escapeHtml(scene.location || scene.prompt)}</p>
    <dl><dt>Prompt</dt><dd>${escapeHtml(scene.prompt)}</dd><dt>Caméra</dt><dd>${escapeHtml(scene.cameraMovement)}</dd><dt>Lumière</dt><dd>${escapeHtml(scene.mood)}</dd><dt>Transition</dt><dd>Raccord de mouvement doux</dd><dt>Continuité</dt><dd>${escapeHtml(scene.negativePrompt)}</dd></dl>
  </article>`).join("");
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Scénario — ${escapeHtml(project.title)}</title><style>body{margin:0;background:#020617;color:#e2e8f0;font:16px/1.55 system-ui,sans-serif}main{max-width:900px;margin:auto;padding:42px 22px}a{color:#67e8f9}header{margin-bottom:28px}.badge{display:inline-block;padding:5px 10px;border-radius:999px;background:${valid ? "#064e3b" : "#7f1d1d"}}article{border:1px solid #1e293b;border-radius:18px;padding:20px;margin:16px 0;background:#0f172a}h1{font-size:clamp(2rem,6vw,4rem);margin:.2em 0}h2{color:#67e8f9}.time,dt{color:#94a3b8}dt{font-weight:700;margin-top:10px}dd{margin:2px 0;white-space:pre-wrap}</style></head><body><main><header><a href="/creations">← Mes créations</a><h1>${escapeHtml(project.title)}</h1><p>${duration} secondes · ${project.scenes.length} plans · <span class="badge">${valid ? "Scénario validé" : "Scénario incomplet"}</span></p><p><a href="/api/projects/${encodeURIComponent(project.id)}/export?format=json">Télécharger JSON</a> · <a href="/api/projects/${encodeURIComponent(project.id)}/export?format=pdf">Télécharger PDF</a></p></header>${rows}</main></body></html>`;
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
