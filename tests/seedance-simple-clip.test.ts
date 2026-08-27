import assert from "node:assert/strict";
import test from "node:test";
import { enrichSimpleClipPrompt, getSimpleClipQuote } from "../lib/simple-clip";

test("le clip simple facture la durée réelle de la musique", () => {
  const quote = getSimpleClipQuote({ ratio: "16:9", quality: "standard", subtitles: false });
  assert.equal(quote.model.modelId, "dreamina-seedance-2-0-260128");
  assert.equal(quote.durationSeconds, 15);
  assert.equal(quote.plan, "TIKTOK");
  assert.equal(quote.totalCredits, 250);
  assert.equal(quote.priceEur, 2.5);
});

test("le clip simple suit la durée fournie jusqu’au plafond de 7 minutes", () => {
  const long = getSimpleClipQuote({ ratio: "9:16", quality: "standard", subtitles: false }, 420);
  assert.equal(long.plan, "PREMIUM");
  assert.equal(long.totalCredits, 7_000);
  assert.equal(long.priceEur, 70);

  const refused = getSimpleClipQuote({ ratio: "9:16", quality: "standard", subtitles: false }, 421);
  assert.equal(refused.plan, "CUSTOM");
  assert.equal(refused.supported, false);
  assert.equal(refused.totalCredits, 0);
});

test("l’amélioration de secours du prompt ne dépend d’aucun fournisseur textuel", () => {
  const prompt = enrichSimpleClipPrompt("Une artiste chante sur une plage.", "Tropical");
  assert.match(prompt, /Une artiste chante sur une plage/);
  assert.match(prompt, /Direction visuelle : Tropical/);
  assert.match(prompt, /rythme de la musique/);
});
