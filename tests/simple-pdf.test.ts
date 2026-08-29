import assert from "node:assert/strict";
import test from "node:test";
import { createTextPdf } from "../lib/simple-pdf";

test("l'export PDF conserve un scénario long sur plusieurs pages", () => {
  const pdf = createTextPdf("Rudyo AI - Storyboard", Array.from({ length: 100 }, (_, index) => `Plan ${index + 1}: description lisible du plan et de son mouvement de caméra.`));
  assert.equal(pdf.subarray(0, 8).toString("ascii"), "%PDF-1.4");
  assert.match(pdf.toString("ascii"), /\/Count 3/);
  assert.match(pdf.toString("ascii"), /Page 3\/3/);
  assert.match(pdf.toString("ascii"), /Plan 100/);
});
