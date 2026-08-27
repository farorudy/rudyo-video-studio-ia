// Déclenche un job précis sur le worker déployé, via requête signée.
import { createHmac, randomUUID } from "node:crypto";

const base = process.env.WORKER_URL;
const secret = process.env.WORKER_SECRET;
const jobId = process.env.JOB_ID;
if (!base || !secret || !jobId) throw new Error("WORKER_URL, WORKER_SECRET et JOB_ID requis");

const body = JSON.stringify({ jobId, idempotencyKey: `clip-worker:${jobId}` });
const timestamp = String(Math.floor(Date.now() / 1000));
const nonce = randomUUID();
const signature = createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");

const response = await fetch(`${base}/jobs`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Rudyo-Timestamp": timestamp,
    "X-Rudyo-Nonce": nonce,
    "X-Rudyo-Signature": signature,
    "Idempotency-Key": `clip-worker:${jobId}`,
  },
  body,
});
console.log(JSON.stringify({ status: response.status, body: (await response.text()).slice(0, 200) }));
