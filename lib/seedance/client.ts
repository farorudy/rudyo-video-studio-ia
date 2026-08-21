import "server-only";

const DEFAULT_BASE_URL = "https://ark.ap-southeast.bytepluses.com/api/v3";

export type BytePlusContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role?: string }
  | { type: "video_url"; video_url: { url: string }; role?: string }
  | { type: "audio_url"; audio_url: { url: string }; role?: string };

export type CreateBytePlusTaskInput = {
  model: string;
  content: BytePlusContent[];
  resolution?: string;
  ratio?: string;
  duration?: number;
  seed?: number;
  camera_fixed?: boolean;
  generate_audio?: boolean;
  watermark?: boolean;
  return_last_frame?: boolean;
};

export type BytePlusTask = {
  id: string;
  model?: string;
  status?: "queued" | "running" | "cancelled" | "succeeded" | "failed" | "expired";
  content?: { video_url?: string; last_frame_url?: string };
  usage?: { completion_tokens?: number; total_tokens?: number };
  error?: { code?: string; message?: string } | null;
  created_at?: number;
  updated_at?: number;
};

export class BytePlusApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "BytePlusApiError";
  }
}

export function isBytePlusDemoMode() {
  return !process.env.ARK_API_KEY?.trim();
}

async function request<T>(pathname: string, init?: RequestInit): Promise<T> {
  const apiKey = process.env.ARK_API_KEY?.trim();
  if (!apiKey) throw new BytePlusApiError("ARK_API_KEY n’est pas configurée.", 503, "missing_api_key");

  let response: Response;
  try {
    response = await fetch(
      `${process.env.BYTEPLUS_BASE_URL?.trim().replace(/\/$/, "") || DEFAULT_BASE_URL}${pathname}`,
      {
        ...init,
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      },
    );
  } catch {
    throw new BytePlusApiError(
      "La réponse BytePlus est incertaine après une erreur réseau. Aucune nouvelle tâche ne sera créée automatiquement.",
      undefined,
      "submission_unknown",
    );
  }

  const payload = response.status === 204 ? ({} as T) : ((await response.json().catch(() => ({}))) as T);
  if (!response.ok) {
    const errorPayload = payload as { error?: { code?: string; message?: string } };
    throw new BytePlusApiError(
      errorPayload.error?.message || `BytePlus a refusé la requête (${response.status}).`,
      response.status,
      errorPayload.error?.code,
    );
  }
  return payload;
}

export const bytePlusClient = {
  createTask(input: CreateBytePlusTaskInput) {
    return request<BytePlusTask>("/contents/generations/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  getTask(taskId: string) {
    return request<BytePlusTask>(`/contents/generations/tasks/${encodeURIComponent(taskId)}`);
  },
  listTasks(query = "") {
    return request<{ items?: BytePlusTask[] }>(`/contents/generations/tasks${query}`);
  },
  deleteTask(taskId: string) {
    return request<Record<string, never>>(`/contents/generations/tasks/${encodeURIComponent(taskId)}`, {
      method: "DELETE",
    });
  },
};
