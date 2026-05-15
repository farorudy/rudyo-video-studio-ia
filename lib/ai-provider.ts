import OpenAI from "openai";
import { Mistral } from "@mistralai/mistralai";

export type AiProvider = "openai" | "mistral" | "ollama";
export type AiProviderName = AiProvider;

export function isAiProvider(value: unknown): value is AiProvider {
  return value === "openai" || value === "mistral" || value === "ollama";
}

export function isRemoteAiProvider(value: unknown): value is "openai" | "mistral" {
  return value === "openai" || value === "mistral";
}

export function resolveDefaultAiProvider(): AiProvider {
  const provider = process.env.AI_PROVIDER;

  if (isAiProvider(provider)) {
    return provider;
  }

  if (process.env.MISTRAL_API_KEY) return "mistral";
  if (process.env.OPENAI_API_KEY) return "openai";

  return "openai";
}

export function resolveModelForProvider(provider: AiProvider) {
  if (provider === "mistral") {
    return process.env.MISTRAL_MODEL || "mistral-small-latest";
  }

  if (provider === "openai") {
    return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  return process.env.OLLAMA_MODEL || "llama3.1";
}

export function resolveRemoteAiSettings(provider?: AiProvider) {
  const selectedProvider = provider || resolveDefaultAiProvider();

  return {
    provider: selectedProvider,
    model: resolveModelForProvider(selectedProvider),
    configured:
      selectedProvider === "mistral"
        ? Boolean(process.env.MISTRAL_API_KEY)
        : selectedProvider === "openai"
          ? Boolean(process.env.OPENAI_API_KEY)
          : true,
  };
}

export async function generateWithOpenAI(prompt: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY manquante.");
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    input: prompt,
  });

  return response.output_text;
}

export async function generateWithMistral(prompt: string) {
  if (!process.env.MISTRAL_API_KEY) {
    throw new Error("MISTRAL_API_KEY manquante.");
  }

  const mistral = new Mistral({
    apiKey: process.env.MISTRAL_API_KEY,
  });

  const response = await mistral.chat.complete({
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

  if (Array.isArray(content)) {
    return content.map((part: any) => part.text ?? "").join("\n");
  }

  return content ?? "";
}

export async function generateAI(prompt: string) {
  const provider = resolveDefaultAiProvider();

  if (provider === "mistral") {
    return {
      provider,
      result: await generateWithMistral(prompt),
    };
  }

  return {
    provider: "openai" as const,
    result: await generateWithOpenAI(prompt),
  };
}

export async function callRemoteChatCompletion(options: any) {
  const provider: AiProvider = isAiProvider(options?.provider)
    ? options.provider
    : resolveDefaultAiProvider();

  const model = options?.model || resolveModelForProvider(provider);

  const messages = Array.isArray(options?.messages)
    ? options.messages
    : [
        {
          role: "user",
          content: options?.prompt || options?.input || "",
        },
      ];

  const prompt = messages
    .map((message: any) => {
      if (typeof message?.content === "string") return message.content;
      if (Array.isArray(message?.content)) {
        return message.content
          .map((part: any) => part?.text ?? "")
          .join("\n");
      }
      return "";
    })
    .join("\n\n");

  if (provider === "mistral") {
    const mistral = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
    });

    const response = await mistral.chat.complete({
      model,
      messages,
    });

    const content = response.choices?.[0]?.message?.content;

    return Array.isArray(content)
      ? content.map((part: any) => part.text ?? "").join("\n")
      : content ?? "";
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await openai.responses.create({
    model,
    input: prompt,
  });

  return response.output_text;
}
