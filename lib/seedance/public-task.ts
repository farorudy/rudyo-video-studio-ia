import "server-only";

import type { GenerationTask } from "@prisma/client";

export function toPublicGenerationTask(task: GenerationTask) {
  return {
    id: task.id,
    projectId: task.projectId,
    sceneId: task.sceneId,
    provider: task.provider,
    modelId: task.modelId,
    status: task.status,
    estimatedCredits: task.estimatedCredits,
    actualCompletionTokens: task.actualCompletionTokens,
    errorCode: task.errorCode,
    errorMessage: task.errorMessage,
    lastPolledAt: task.lastPolledAt,
    completedAt: task.completedAt,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    permanentVideoUrl: task.permanentVideoUrl
      ? `/api/seedance/tasks/${encodeURIComponent(task.id)}/download`
      : null,
  };
}
