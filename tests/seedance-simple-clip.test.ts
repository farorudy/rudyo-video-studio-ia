import assert from "node:assert/strict";
import test from "node:test";
import { enrichSimpleClipPrompt, getSimpleClipQuote } from "../lib/simple-clip";

test("le clip simple standard applique le prix fixe du pack 3 min 30", () => {
  const quote = getSimpleClipQuote({ ratio: "16:9", quality: "standard", subtitles: false });
  assert.equal(quote.model.modelId, "dreamina-seedance-2-0-260128");
  assert.equal(quote.durationSeconds, 15);
  assert.equal(quote.totalCredits, 3_500);
  assert.equal(quote.priceEur, 35);
});

test("l’amélioration de secours du prompt ne dépend d’aucun fournisseur textuel", () => {
  const prompt = enrichSimpleClipPrompt("Une artiste chante sur une plage.", "Tropical");
  assert.match(prompt, /Une artiste chante sur une plage/);
  assert.match(prompt, /Direction visuelle : Tropical/);
  assert.match(prompt, /rythme de la musique/);
});
