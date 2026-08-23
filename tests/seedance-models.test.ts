import assert from "node:assert/strict";
import test from "node:test";
import { chooseSeedanceModel, getSeedanceModel, listAvailableSeedanceModels } from "../lib/seedance/models";

test("le registre ne publie aucun identifiant inventé", () => {
  const models = listAvailableSeedanceModels();
  assert.ok(models.length >= 4);
  assert.ok(models.every((model) => model.modelId?.startsWith("dreamina-seedance-")));
});

test("le choix automatique utilise Seedance 2.0 comme solution qualité", () => {
  const model = chooseSeedanceModel({ durationSeconds: 5, referenceCount: 0 });
  assert.equal(model.modelId, "dreamina-seedance-2-0-260128");
});

test("un modèle explicitement inconnu est refusé", () => {
  assert.throws(() => chooseSeedanceModel({ requestedModelId: "modele-invente", durationSeconds: 5, referenceCount: 0 }));
  assert.equal(getSeedanceModel("modele-invente"), undefined);
});

test("un modèle connu mais non activé côté serveur est refusé", () => {
  assert.throws(() => chooseSeedanceModel({ requestedModelId: "dreamina-seedance-2-5-260628", durationSeconds: 5, referenceCount: 0 }));
});
