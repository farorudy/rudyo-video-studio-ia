import { callTutorCompletion } from "@/lib/cipfaro-tutor-completion";
import { buildTutorAgentInstructions } from "@/lib/cipfaro-tutor-agent";

type Message = { role: "user" | "assistant"; content: string };
type Dependencies = { send?: typeof fetch; env?: Record<string, string | undefined> };
const PORTAL = "https://pygedqyfxnacrnoflukz.supabase.co";
// Publishable client key; never a service-role or secret key.
const PUBLIC_KEY = "sb_publishable_6uNfUf7gpo_CSBQ1g-B7ig_FuQgbtPX";
const ORIGINS = ["https://cipfaro-portail.vercel.app", "https://cipfaro-formation.org", "https://www.cipfaro-formation.org"];

export async function handleTutor(request: Request, dependencies: Dependencies = {}) {
  const send = dependencies.send ?? fetch;
  const env = dependencies.env ?? process.env;
  const origin = request.headers.get("origin") ?? "";
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": ORIGINS.includes(origin) ? origin : ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization,apikey,content-type",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
  const reply = (status: number, body: object) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !ORIGINS.includes(origin)) return reply(403, { message: "Origine refusée." });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply(405, { message: "Méthode refusée." });
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return reply(401, { message: "Connectez-vous." });
  let stage = "validation";
  try {
    const raw = await request.text();
    if (raw.length > 18000) return reply(400, { message: "Conversation trop longue." });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { message: "Message invalide." }); }
    if (!body || typeof body.lesson_id !== "string" ||
        !Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 10 ||
        body.messages.some((m: Message) => !m || !["user", "assistant"].includes(m.role) || typeof m.content !== "string" || m.content.length > 2000) ||
        body.messages.at(-1).role !== "user") return reply(400, { message: "Message invalide (2000 caractères maximum)." });
    const backendHeaders = { apikey: PUBLIC_KEY, Authorization: authorization, "Content-Type": "application/json" };
    stage = "session";
    const session = await send(PORTAL + "/auth/v1/user", { headers: backendHeaders, signal: AbortSignal.timeout(10000) });
    if (!session.ok) return reply(401, { message: "Session expirée." });
    // Select only the provider configured by the administrator, never by the caller.
    const provider = env.AI_PROVIDER?.trim() || env.DEFAULT_AI_PROVIDER?.trim() ||
      (env.MISTRAL_API_KEY ? "mistral" : env.OPENAI_API_KEY ? "openai" : "");
    if (!["mistral", "openai"].includes(provider))
      return reply(503, { message: "Le service du tuteur pédagogique doit être configuré." });
    const apiKey = provider === "mistral" ? env.MISTRAL_API_KEY : env.OPENAI_API_KEY;
    const model = provider === "mistral" ? env.MISTRAL_MODEL || "mistral-small-latest" : env.OPENAI_MODEL;
    if (!apiKey?.trim() || !model?.trim())
      return reply(503, { message: "Configuration du tuteur pédagogique incomplète." });
    stage = "cours";
    // Uses the learner JWT: the RPC enforces lesson access and reserves the existing LMS quota once.
    const context = await send(PORTAL + "/rest/v1/rpc/lms_ai_reserve", {
      method: "POST", headers: backendHeaders, body: JSON.stringify({ lid: body.lesson_id }),
      signal: AbortSignal.timeout(10000),
    });
    if (!context.ok) return reply(context.status === 429 ? 429 : 403, { message: "Accès au cours refusé ou quota pédagogique atteint." });
    const lesson = await context.json();
    const prompt = buildTutorAgentInstructions(lesson);
    stage = "moteur";
    const completion = await callTutorCompletion({
      provider: provider as "openai" | "mistral",
      apiKey: apiKey.trim(),
      model: model.trim(),
      messages: [{ role: "system", content: prompt }, ...body.messages],
      maxTokens: 700,
      send,
    });
    if (!completion.ok) {
      console.error("rudyo_tutor_provider_rejected", provider, completion.status);
      return reply(completion.status === 429 ? 429 : 503, { message: "Tuteur pédagogique indisponible (HTTP " + completion.status + ")." });
    }
    if (!completion.answer.trim()) return reply(503, { message: "Le tuteur pédagogique n'a pas renvoyé de réponse." });
    return reply(200, { answer: completion.answer.trim() });
  } catch {
    // Never log tokens, prompts, lesson contents or raw provider errors.
    console.error("rudyo_tutor_failed", stage);
    return reply(503, { message: "Connexion RudyoAI interrompue. Réessayez." });
  }
}
