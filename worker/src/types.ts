import { z } from "zod";

export const montageManifestSchema = z.object({
  version: z.literal(1),
  jobId: z.string().min(1),
  userId: z.string().min(1),
  projectId: z.string().min(1),
  finalExportId: z.string().min(1),
  generationId: z.string().min(1),
  systemTestRunId: z.string().min(1).optional(),
  systemTestScenario: z.enum(["SUCCESS", "INVALID_VIDEO", "MISSING_AUDIO", "INTERRUPTED_WORKER", "EXPIRED_LEASE", "STORAGE_FAILURE", "DOUBLE_CLAIM", "IDEMPOTENCY_REPLAY"]).optional(),
  expectedDurationSeconds: z.number().positive().max(7200),
  scenes: z.array(z.object({
    order: z.number().int().nonnegative(),
    storageKey: z.string().min(1),
    durationSeconds: z.number().positive().max(300),
  }).strict()).min(1).max(100),
  audio: z.object({ storageKey: z.string().min(1), startSeconds: z.number().nonnegative().max(7200).optional(), durationSeconds: z.number().positive().max(420).optional() }).strict(),
  output: z.object({
    storageKey: z.string().min(1),
    format: z.enum(["16:9", "9:16", "1:1"]),
    resolution: z.enum(["720p", "1080p"]),
    transition: z.enum(["cut", "crossfade"]),
    subtitles: z.boolean(),
  }).strict(),
  creditReservationIds: z.array(z.string().min(1)).max(100),
}).strict();

export type MontageManifest = z.infer<typeof montageManifestSchema>;

export type MontageJob = {
  id: string;
  userId: string;
  projectId: string;
  finalExportId: string;
  generationId: string;
  status: string;
  progress: number;
  inputManifest: unknown;
  outputPath: string;
  attemptCount: number;
  maxAttempts: number;
  lockedBy: string | null;
};

export type WorkerStage = "DOWNLOADING" | "PREPARING" | "RENDERING" | "UPLOADING";

export const clipWorkerManifestSchema = z.object({
  version: z.literal(1),
  jobId: z.string().uuid(),
  userId: z.string().min(1),
  projectId: z.string().min(1),
  finalExportId: z.string().uuid(),
  photoStorageKey: z.string().min(1),
  audioStorageKey: z.string().min(1),
  audioStartSeconds: z.number().nonnegative().max(7200),
  durationSeconds: z.number().positive().max(420),
  referenceAssetUri: z.string().regex(/^asset:\/\/[a-zA-Z0-9._:-]+$/).nullable(),
  scenes: z.array(z.object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    title: z.string().min(1),
    prompt: z.string().min(10).max(10_000),
    durationSeconds: z.number().int().min(4).max(15),
    modelId: z.literal("dreamina-seedance-2-0-260128"),
    resolution: z.literal("720p"),
    ratio: z.literal("9:16"),
  }).strict()).min(1).max(105),
  outputStorageKey: z.string().min(1),
  plan: z.enum(["TIKTOK", "LONG", "PREMIUM"]),
  creditReservationId: z.string().min(1),
}).strict();

export type ClipWorkerManifest = z.infer<typeof clipWorkerManifestSchema>;
export type ClipWorkerJob = {
  id: string;
  userId: string;
  projectId: string;
  finalExportId: string;
  status: string;
  progress: number;
  inputManifest: unknown;
  outputPath: string;
  attemptCount: number;
  maxAttempts: number;
  lockedBy: string | null;
};
