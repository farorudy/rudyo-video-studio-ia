export type MontageManifest = {
  version: 1;
  jobId: string;
  userId: string;
  projectId: string;
  finalExportId: string;
  generationId: string;
  systemTestRunId?: string;
  systemTestScenario?: "SUCCESS" | "INVALID_VIDEO" | "MISSING_AUDIO" | "INTERRUPTED_WORKER" | "EXPIRED_LEASE" | "STORAGE_FAILURE" | "DOUBLE_CLAIM" | "IDEMPOTENCY_REPLAY";
  expectedDurationSeconds: number;
  scenes: Array<{
    order: number;
    storageKey: string;
    durationSeconds: number;
  }>;
  audio: {
    storageKey: string;
    startSeconds?: number;
    durationSeconds?: number;
  };
  output: {
    storageKey: string;
    format: "16:9" | "9:16" | "1:1";
    resolution: "720p" | "1080p";
    transition: "cut" | "crossfade";
    subtitles: boolean;
  };
  creditReservationIds: string[];
};
