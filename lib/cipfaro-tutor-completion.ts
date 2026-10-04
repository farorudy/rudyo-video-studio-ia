export type TutorProvider = "openai" | "mistral";
export type TutorChatMessage = { role: "system" | "user" | "assistant"; content: string };

type CompletionOptions = {
  provider: TutorProvider;
  apiKey: string;
  model: string;
  messages: TutorChatMessage[];
  maxTokens: number;
  timeoutMs?: number;
  send?: typeof fetch;
};

export async function callTutorCompletion({
  provider,
  apiKey,
  model,
  messages,
  maxTokens,
  timeoutMs = 45_000,
  send = fetch,
}: CompletionOptions) {
  const endpoint = provider === "openai"
    ? "https://api.openai.com/v1/chat/completions"
    : "https://api.mistral.ai/v1/chat/completions";
  const response = await send(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      ...(provider === "mistral" ? { max_tokens: maxTokens } : { max_completion_tokens: maxTokens }),
      messages,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) return { ok: false as const, status: response.status };
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  const answer = typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part: { text?: string }) => part.text || "").join("\n")
      : "";

  return {
    ok: true as const,
    answer,
    model: typeof data.model === "string" ? data.model : model,
    totalTokens: typeof data.usage?.total_tokens === "number" ? data.usage.total_tokens : null,
  };
}