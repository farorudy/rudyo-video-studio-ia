/**
 * Porte unique de la facturation.
 *
 * Volontairement sans « server-only » : logique pure, sans secret ni API
 * serveur, afin d'être vérifiable directement par les tests de sécurité.
 *
 * Incident du 27 août 2026 : un worker de démonstration branché sur la base de
 * production a réclamé de vraies tâches payantes et rendu des MP4 de six
 * secondes. `workerAvailable` valait « true » simplement parce que les
 * variables d'environnement étaient renseignées.
 *
 * Règle : aucun crédit n'est réservé si l'une des conditions manque. Toute
 * valeur inconnue est traitée comme un refus, jamais comme une autorisation.
 */

export type WorkerMode = "mock" | "seedance";

export interface WorkerHealth {
  reachable: boolean;
  mode: WorkerMode | null;
  providerReady: boolean;
  ffmpegReady: boolean;
  databaseReady: boolean;
  storageReady: boolean;
}

export type PaidGenerationRefusal =
  | "PAID_GENERATION_DISABLED"
  | "WORKER_EXPECTED_MODE_INVALID"
  | "WORKER_MODE_MISMATCH"
  | "WORKER_UNREACHABLE"
  | "WORKER_IN_MOCK_MODE"
  | "PROVIDER_NOT_READY"
  | "FFMPEG_NOT_READY"
  | "DATABASE_NOT_READY"
  | "STORAGE_NOT_READY";

export const PAID_GENERATION_UNAVAILABLE_MESSAGE =
  "Le service de création réelle est temporairement indisponible. Aucun crédit ne sera débité.";

/** `true` uniquement en production réelle. Sert à interdire toute facturation simulée. */
export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.VERCEL_ENV === "production" || (!env.VERCEL_ENV && env.NODE_ENV === "production");
}

/**
 * `ALLOW_MOCK_BILLING` est un interrupteur de développement. Il est ignoré en
 * production même s'il est positionné par erreur ou par un tiers.
 */
export function mockBillingAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  if (isProductionRuntime(env)) return false;
  return env.ALLOW_MOCK_BILLING === "true";
}

export function canStartPaidGeneration(
  health: Partial<WorkerHealth> | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): { allowed: true } | { allowed: false; refusal: PaidGenerationRefusal } {
  if (env.PAID_GENERATION_ENABLED !== "true") {
    return { allowed: false, refusal: "PAID_GENERATION_DISABLED" };
  }

  const expectedMode = env.WORKER_EXPECTED_MODE;
  if (expectedMode !== "mock" && expectedMode !== "seedance") {
    return { allowed: false, refusal: "WORKER_EXPECTED_MODE_INVALID" };
  }

  if (!health?.reachable) return { allowed: false, refusal: "WORKER_UNREACHABLE" };

  if (health.mode !== expectedMode) {
    return { allowed: false, refusal: "WORKER_MODE_MISMATCH" };
  }

  if (health.mode !== "seedance") {
    // Hors production, un worker simulé peut facturer des crédits factices.
    return { allowed: false, refusal: "WORKER_IN_MOCK_MODE" };
  }

  if (!health.providerReady) return { allowed: false, refusal: "PROVIDER_NOT_READY" };
  if (!health.ffmpegReady) return { allowed: false, refusal: "FFMPEG_NOT_READY" };
  if (!health.databaseReady) return { allowed: false, refusal: "DATABASE_NOT_READY" };
  if (!health.storageReady) return { allowed: false, refusal: "STORAGE_NOT_READY" };
  return { allowed: true };
}
