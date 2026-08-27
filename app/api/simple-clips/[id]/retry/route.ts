import { ClipWorkerJobStatus, TransactionStatus, VideoProjectStatus } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dispatchRailwayClipJob } from "@/lib/montage/worker-client";
import { prisma } from "@/lib/prisma";
import { beginIdempotentRequest, finishIdempotentRequest, requireIdempotencyKey } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Une tâche encore verrouillée par un worker disparu est considérée bloquée. */
const STALLED_STATUSES = new Set<ClipWorkerJobStatus>([
  ClipWorkerJobStatus.QUEUED,
  ClipWorkerJobStatus.CLAIMED,
  ClipWorkerJobStatus.PREPARING,
  ClipWorkerJobStatus.RENDERING,
  ClipWorkerJobStatus.UPLOADING,
  ClipWorkerJobStatus.RETRYING,
]);
const FAILED_STATUSES = new Set<ClipWorkerJobStatus>([ClipWorkerJobStatus.FAILED, ClipWorkerJobStatus.REFUNDED]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user || user.localSession) return NextResponse.json({ error: "Authentification requise." }, { status: 401 });
  const { id } = await params;
  const key = requireIdempotencyKey(request);
  const idem = await beginIdempotentRequest("simple-clip-retry", user.id, key);
  if (!idem.fresh) {
    if (idem.record.response && idem.record.responseCode) return NextResponse.json(idem.record.response, { status: idem.record.responseCode });
    return NextResponse.json({ error: "Relance déjà en cours." }, { status: 409 });
  }

  const respond = async (status: number, body: Record<string, unknown>) => {
    await finishIdempotentRequest(idem.record.id, status, body).catch(() => undefined);
    return NextResponse.json(body, { status });
  };

  try {
    const project = await prisma.videoProject.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        status: true,
        creditReservationId: true,
        clipWorkerJobs: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!project) return await respond(404, { error: "Création introuvable." });

    const job = project.clipWorkerJobs[0];
    if (!job) return await respond(409, { error: "Aucune tâche à relancer pour ce projet." });
    if (job.status === ClipWorkerJobStatus.SUCCEEDED) return await respond(409, { error: "Ce clip est déjà terminé." });

    const stalled = STALLED_STATUSES.has(job.status) && (!job.leaseExpiresAt || job.leaseExpiresAt.getTime() < Date.now());
    if (!FAILED_STATUSES.has(job.status) && !stalled) {
      return await respond(409, { error: "Votre clip est toujours en cours de création." });
    }

    // Aucun second débit : la relance exige une réservation encore active.
    // Après un remboursement, une nouvelle création doit repartir du début.
    const reservation = project.creditReservationId
      ? await prisma.creditTransaction.findUnique({ where: { id: project.creditReservationId }, select: { id: true, status: true } })
      : null;
    if (!reservation || reservation.status !== TransactionStatus.RESERVED) {
      return await respond(409, {
        error: "Vos crédits vous ont déjà été remboursés pour ce projet. Lancez une nouvelle création : vous ne serez pas débité deux fois.",
        refunded: true,
      });
    }

    // Une seule tâche est relancée, même en cas de double clic : le passage
    // de l’état courant vers QUEUED n’est gagné que par un seul appel.
    const requeued = await prisma.clipWorkerJob.updateMany({
      where: { id: job.id, status: job.status },
      data: {
        status: ClipWorkerJobStatus.QUEUED,
        progress: 0,
        lockedBy: null,
        lockedAt: null,
        leaseExpiresAt: null,
        availableAt: new Date(),
        errorCode: null,
        errorMessage: null,
        completedAt: null,
        maxAttempts: { increment: 1 },
      },
    });
    if (requeued.count !== 1) return await respond(409, { error: "Une relance est déjà en cours." });

    await prisma.clipWorkerJobEvent.create({
      data: { jobId: job.id, status: ClipWorkerJobStatus.QUEUED, progress: 0, message: "Relance demandée par le client, sans nouveau débit" },
    });
    await prisma.videoProject.updateMany({
      where: { id: project.id, status: { not: VideoProjectStatus.COMPLETED } },
      data: { status: VideoProjectStatus.GENERATING },
    });

    const dispatch = await dispatchRailwayClipJob(job.id);
    return await respond(202, {
      success: true,
      projectId: project.id,
      workerJobId: job.id,
      reused: true,
      charged: false,
      workerWaking: !dispatch.accepted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "La relance n’a pas pu démarrer.";
    return await respond(400, { error: message });
  }
}
