import assert from "node:assert/strict";
import test from "node:test";
import { projectAccessStatus } from "../lib/project-access";

test("une route projet refuse un utilisateur non connecté", () => {
  assert.equal(projectAccessStatus(null, "owner-1"), 401);
});

test("un utilisateur ne peut pas télécharger le fichier d’un autre projet", () => {
  assert.equal(projectAccessStatus("user-2", "user-1"), 403);
});

test("le propriétaire du projet est autorisé", () => {
  assert.equal(projectAccessStatus("user-1", "user-1"), 200);
});
