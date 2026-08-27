import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL?.includes("127.0.0.1:55432/rudyo_worker_local")) throw new Error("Base locale isolée requise.");
const prisma = new PrismaClient();
try {
  const [heartbeats, jobs, projects, clock] = await Promise.all([
    prisma.workerHeartbeat.findMany({ orderBy: { lastSeenAt: "desc" }, take: 3 }),
    prisma.clipWorkerJob.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { events: { orderBy: { createdAt: "asc" } } } }),
    prisma.videoProject.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, userId: true, status: true, creditReservationId: true } }),
    prisma.$queryRaw`SELECT NOW() AS now`,
  ]);
  console.log(JSON.stringify({
    heartbeats: heartbeats.map((item) => ({ id: item.id, status: item.status, ffmpegAvailable: item.ffmpegAvailable, databaseAvailable: item.databaseAvailable, storageAvailable: item.storageAvailable, errorCode: item.errorCode, lastSeenAt: item.lastSeenAt })),
    jobs: jobs.map((item) => ({ id: item.id, status: item.status, progress: item.progress, attemptCount: item.attemptCount, availableAt: item.availableAt, createdAt: item.createdAt, errorCode: item.errorCode, events: item.events.map((event) => ({ status: event.status, progress: event.progress })) })),
    projects,
    databaseNow: clock[0]?.now,
  }));
} finally {
  await prisma.$disconnect();
}
