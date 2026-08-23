import assert from "node:assert/strict";
import test from "node:test";
import { quoteSeedanceCredits } from "../lib/seedance/pricing";

test("Seedance 2.0 720p facture chaque seconde", () => {
  const quote = quoteSeedanceCredits({
    modelId: "dreamina-seedance-2-0-260128",
    durationSeconds: 30,
    resolution: "720p",
    ratio: "16:9",
  });
  assert.equal(quote.unitCredits, 20);
  assert.equal(quote.totalCredits, 600);
});

test("la résolution 1080p utilise le tarif serveur correspondant", () => {
  const quote = quoteSeedanceCredits({
    modelId: "dreamina-seedance-2-0-260128",
    durationSeconds: 5,
    resolution: "1080p",
    ratio: "9:16",
    generateAudio: true,
  });
  assert.equal(quote.totalCredits, 250);
});

test("un modèle sans tarif Rudyo est bloqué", () => {
  assert.throws(() => quoteSeedanceCredits({
    modelId: "dreamina-seedance-2-5-260628",
    durationSeconds: 5,
    resolution: "720p",
    ratio: "16:9",
  }), /tarif Rudyo/);
});
