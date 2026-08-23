import assert from "node:assert/strict";
import test from "node:test";
import { ApiResponseError, readApiResponse } from "../lib/client-api";

test("une réponse vide est refusée avec un message explicite", async () => {
  await assert.rejects(
    () => readApiResponse(new Response("", { status: 200 })),
    (error: unknown) => error instanceof ApiResponseError && error.message.includes("réponse vide"),
  );
});

test("une réponse HTML ne peut pas être interprétée comme du JSON", async () => {
  await assert.rejects(
    () => readApiResponse(new Response("<html>Erreur</html>", { status: 502, headers: { "Content-Type": "text/html" } })),
    (error: unknown) => error instanceof ApiResponseError && error.status === 502,
  );
});

test("un JSON invalide est signalé sans SyntaxError non gérée", async () => {
  await assert.rejects(
    () => readApiResponse(new Response("{", { status: 200, headers: { "Content-Type": "application/json" } })),
    (error: unknown) => error instanceof ApiResponseError && error.message.includes("JSON invalide"),
  );
});

test("le message JSON du serveur est conservé pour les erreurs HTTP", async () => {
  await assert.rejects(
    () => readApiResponse(new Response(JSON.stringify({ error: "Projet interdit." }), { status: 403, headers: { "Content-Type": "application/json" } })),
    (error: unknown) => error instanceof ApiResponseError && error.status === 403 && error.message === "Projet interdit.",
  );
});
