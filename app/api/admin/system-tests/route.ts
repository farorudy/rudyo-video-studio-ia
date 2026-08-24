import { SystemTestScenario } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminFromRequest, hasStrictSameOrigin, verifyAdminCsrfToken } from "@/lib/admin-auth";
import { getMontageServiceStatus } from "@/lib/montage/worker-status";
import { prisma } from "@/lib/prisma";
import { beginIdempotentRequest, enforceApiRateLimit, finishIdempotentRequest, readJsonWithLimit, requireIdempotencyKey } from "@/lib/request-security";
import { issueSystemTestDownloadToken, startSystemMontageTest, systemTestsEnabled } from "@/lib/system-tests/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const schema = z.object({ scenario: z.nativeEnum(SystemTestScenario).default(SystemTestScenario.SUCCESS) }).strict();

function unauthorized() {
  return NextResponse.json({ success: false, error: "Accès administrateur requis." }, { status: 401 });
}

function eventStep(event: { status: string; message: string; createdAt: Date }, previous?: Date) {
  return {
    name: event.status,
    status: "SUCCEEDED",
    at: event.createdAt.toISOString(),
    durationMs: previous ? Math.max(0, event.createdAt.getTime() - previous.getTime()) : 0,
    message: event.message,
  };
}

export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorized();
  const [worker, runs] = await Promise.all([
    getMontageServiceStatus(),
    prisma.systemTestRun.findMany({
      where: { adminSubject: admin.subject },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  const jobIds = runs.flatMap((run) => run.montageJobId ? [run.montageJobId] : []);
  const events = jobIds.length ? await prisma.montageJobEvent.findMany({ where: { jobId: { in: jobIds } }, orderBy: { createdAt: "asc" } }) : [];
  const jobs = jobIds.length ? await prisma.montageJob.findMany({ where: { id: { in: jobIds } }, select: { id: true, status: true, progress: true, attemptCount: true, maxAttempts: true } }) : [];
  const latestSucceeded = runs.find((run) => run.status === "SUCCEEDED" && !run.cleanedAt);
  const downloadToken = latestSucceeded ? await issueSystemTestDownloadToken(latestSucceeded.id, admin.subject) : null;

  return NextResponse.json({
    success: true,
    enabled: systemTestsEnabled(),
    worker,
    runs: runs.map((run) => {
      const runEvents = events.filter((event) => event.jobId === run.montageJobId);
      const storedSteps = Array.isArray(run.steps) ? run.steps : [];
      const eventSteps = runEvents.map((event, index) => eventStep(event, index ? runEvents[index - 1].createdAt : run.createdAt));
      const verificationSteps = run.status === "SUCCEEDED" ? [
        { name: "VERIFYING_RESULT", status: "SUCCEEDED", at: run.completedAt?.toISOString(), durationMs: 0, message: "Résultat FFprobe vérifié" },
      ] : [];
      const job = jobs.find((item) => item.id === run.montageJobId);
      return {
        id: run.id,
        scenario: run.scenario,
        status: run.status,
        createdAt: run.createdAt.toISOString(),
        completedAt: run.completedAt?.toISOString() || null,
        expiresAt: run.expiresAt.toISOString(),
        cleanedAt: run.cleanedAt?.toISOString() || null,
        errorCode: run.errorCode,
        errorMessage: run.errorMessage,
        balanceBefore: run.balanceBefore,
        balanceAfter: run.balanceAfter,
        billingVerified: run.billingVerified,
        bytePlusCallVerified: run.bytePlusCallVerified,
        diagnostics: run.diagnostics,
        progress: job?.progress || (run.status === "SUCCEEDED" ? 100 : 0),
        attemptCount: job?.attemptCount || 0,
        steps: [...storedSteps, ...eventSteps, ...verificationSteps],
        downloadUrl: latestSucceeded?.id === run.id && downloadToken
          ? `/api/admin/system-tests/${encodeURIComponent(run.id)}/download?token=${encodeURIComponent(downloadToken)}`
          : null,
      };
    }),
  }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) return unauthorized();
  if (!hasStrictSameOrigin(request) || !verifyAdminCsrfToken(request)) {
    return NextResponse.json({ success: false, error: "Protection de requête invalide." }, { status: 403 });
  }
  if (!systemTestsEnabled()) return NextResponse.json({ success: false, error: "Le test système est désactivé." }, { status: 404 });
  let idempotencyId: string | null = null;
  try {
    await enforceApiRateLimit(request, "admin-system-montage-test", admin.subject, 2, 60 * 60_000);
    const key = requireIdempotencyKey(request);
    const idempotency = await beginIdempotentRequest("admin-system-montage-test", admin.subject, key);
    idempotencyId = idempotency.record.id;
    if (!idempotency.fresh) {
      if (idempotency.record.response && idempotency.record.responseCode) return NextResponse.json(idempotency.record.response, { status: idempotency.record.responseCode });
      return NextResponse.json({ success: false, error: "Ce test est déjà en préparation." }, { status: 409 });
    }
    const parsed = schema.parse(await readJsonWithLimit<unknown>(request, 1024));
    const result = await startSystemMontageTest(admin, parsed.scenario);
    const response = { success: true, runId: result.runId, status: result.status };
    await Promise.all([
      finishIdempotentRequest(idempotency.record.id, 202, response),
      prisma.adminAuditLog.create({ data: { adminSubject: admin.subject, action: "SYSTEM_MONTAGE_TEST_STARTED", metadata: { runId: result.runId, scenario: parsed.scenario, billingMode: "NON_BILLABLE" } } }),
    ]);
    return NextResponse.json(response, { status: 202 });
  } catch (error) {
    const code = error instanceof Error ? error.message : "SYSTEM_TEST_FAILED";
    const status = code === "WORKER_OFFLINE" ? 503 : code === "ADMIN_USER_REQUIRED" ? 409 : code === "SYSTEM_TEST_DISABLED" ? 404 : 400;
    const message = code === "WORKER_OFFLINE"
      ? "Le worker de montage n’est pas disponible. Aucun test n’a été lancé."
      : code === "ADMIN_USER_REQUIRED"
        ? "Le compte administrateur doit également posséder un compte Rudyo vérifié."
        : "Le test système n’a pas pu démarrer.";
    if (idempotencyId) await finishIdempotentRequest(idempotencyId, status, { success: false, error: message }).catch(() => undefined);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
