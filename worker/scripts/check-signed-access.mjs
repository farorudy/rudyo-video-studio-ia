// Vérifie que le worker déployé accepte une requête signée et rejette le rejeu.
// Le secret arrive par variable d'environnement et n'est jamais affiché.
import { createHmac, randomUUID } from "node:crypto";

const base = process.env.WORKER_URL;
const secret = process.env.WORKER_SECRET;
if (!base || !secret) throw new Error("WORKER_URL et WORKER_SECRET requis");

function sign(body, timestamp, nonce) {
  return createHmac("sha256", secret).update(`${timestamp}.${nonce}.${body}`).digest("hex");
}

async function call(pathname, body, { timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomUUID() } = {}) {
  const response = await fetch(`${base}${pathname}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Rudyo-Timestamp": timestamp,
      "X-Rudyo-Nonce": nonce,
      "X-Rudyo-Signature": sign(body ?? "", timestamp, nonce),
      ...(body === undefined ? {} : { "Idempotency-Key": `probe:${nonce}` }),
    },
    body,
  });
  return { status: response.status, body: (await response.text()).slice(0, 160) };
}

const health = await call("/health");
console.log("health signé          :", JSON.stringify(health));

// Job inexistant : la signature doit être acceptée, la tâche refusée ensuite.
const nonce = randomUUID();
const payload = JSON.stringify({ jobId: "00000000-0000-4000-8000-000000000000", idempotencyKey: `probe:${nonce}` });
const first = await call("/jobs", payload, { nonce });
console.log("jobs signé (inconnu)  :", JSON.stringify(first));

// Rejeu exact du même horodatage et du même nonce.
const timestamp = String(Math.floor(Date.now() / 1000));
const replayNonce = randomUUID();
const one = await call("/jobs", payload, { timestamp, nonce: replayNonce });
const two = await call("/jobs", payload, { timestamp, nonce: replayNonce });
console.log("jobs rejeu 1          :", JSON.stringify(one));
console.log("jobs rejeu 2          :", JSON.stringify(two));

// Horodatage périmé : doit être refusé.
const stale = await call("/jobs", payload, { timestamp: String(Math.floor(Date.now() / 1000) - 3600) });
console.log("jobs horodatage vieux :", JSON.stringify(stale));
