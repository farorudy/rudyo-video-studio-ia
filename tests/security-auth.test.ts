import assert from "node:assert/strict";
import test from "node:test";
import { evaluateOtp } from "../lib/auth-policy";

const now = new Date("2026-08-21T12:00:00.000Z");
const validRecord = {
  tokenHash: "a".repeat(64),
  expiresAt: new Date(now.getTime() + 60_000),
  usedAt: null,
  attempts: 0,
  maxAttempts: 5,
};

test("connaître seulement l’e-mail ne valide jamais un défi OTP", () => {
  assert.deepEqual(evaluateOtp(null, validRecord.tokenHash, now), { ok: false, reason: "missing" });
  assert.deepEqual(evaluateOtp(validRecord, "b".repeat(64), now), { ok: false, reason: "invalid" });
});

test("un OTP valide, non expiré et non consommé est accepté", () => {
  assert.deepEqual(evaluateOtp(validRecord, validRecord.tokenHash, now), { ok: true });
});

test("un OTP expiré ou déjà utilisé est refusé", () => {
  assert.deepEqual(
    evaluateOtp({ ...validRecord, expiresAt: new Date(now.getTime() - 1) }, validRecord.tokenHash, now),
    { ok: false, reason: "expired" },
  );
  assert.deepEqual(
    evaluateOtp({ ...validRecord, usedAt: new Date(now.getTime() - 1) }, validRecord.tokenHash, now),
    { ok: false, reason: "used" },
  );
});

test("un OTP verrouillé après le nombre maximal d’essais est refusé", () => {
  assert.deepEqual(
    evaluateOtp({ ...validRecord, attempts: 5 }, validRecord.tokenHash, now),
    { ok: false, reason: "locked" },
  );
});
