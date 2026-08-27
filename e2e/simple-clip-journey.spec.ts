import { expect, test } from "@playwright/test";
import { wavFile } from "./audio-fixture";

// 180 s facturées à la durée réelle : 3 000 crédits, soit 30,00 €.
const quote = {
  success: true, totalCredits: 3_000, requiredCredits: 3_000, priceEur: 30,
  audioDurationSeconds: 180, normalizedSeconds: 180, billableDurationSeconds: 180,
  plan: "TIKTOK", planName: "Formule Clip TikTok", supported: true,
  fitsSelectedPlan: true, recommendedPlan: null, maxPriceEur: 35,
  balance: 5_000, balanceAfter: 2_000, missingCredits: 0, missingPriceEur: 0,
  allowed: true, workerAvailable: true, refusalCode: null,
};

test("les formules sont présentées comme des plafonds, jamais comme des prix fixes", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/simple-clips/quote", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ success: true, user: { id: "user-test", email: "debutant@example.com", name: "Débutant", creditsRemaining: 5_000 } }),
  }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choisissez votre formule" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clip jusqu’à 3 min 30", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clip jusqu’à 5 minutes", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clip jusqu’à 7 minutes", exact: true })).toBeVisible();
  await expect(page.getByText("maximum 35 €", { exact: true })).toBeVisible();
  await expect(page.getByText("maximum 50 €", { exact: true })).toBeVisible();
  await expect(page.getByText("maximum 70 €", { exact: true })).toBeVisible();
  await expect(page.getByText("Prix calculé automatiquement selon la durée réelle de votre musique.").first()).toBeVisible();
  await page.getByRole("button", { name: "Choisir le clip jusqu’à 5 minutes" }).click();
  await expect(page.getByRole("button", { name: "Formule sélectionnée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ma photo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ma musique" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mon idée de clip" })).toBeVisible();
  await expect(page.getByText("Demander un devis", { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("un devis en échec est expliqué au lieu de laisser un bouton mort", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: null }),
  }));
  await page.route("**/api/simple-clips/quote", (route) => route.fulfill({
    status: 400, contentType: "application/json",
    body: JSON.stringify({ error: "La durée de la musique n’a pas pu être vérifiée." }),
  }));

  await page.goto("/");
  await page.locator('input[type="file"][accept*="audio"]').setInputFiles(wavFile(3));

  const panel = page.getByTestId("clip-quote-error");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Le prix n’a pas pu être calculé.");
  await expect(panel).toContainText("La durée de la musique n’a pas pu être vérifiée.");
  await expect(panel.getByRole("button", { name: "Recalculer le prix" })).toBeVisible();
  await expect(page.getByTestId("clip-primary-action")).toContainText("Prix indisponible");
});

test("un refus 413 en texte brut devient un message compréhensible", async ({ page }) => {
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: null }),
  }));
  // Réponse de l'hébergeur quand le corps dépasse la limite : ce n'est pas du JSON.
  await page.route("**/api/simple-clips/quote", (route) => route.fulfill({
    status: 413, contentType: "text/plain", body: "Request Entity Too Large\nFUNCTION_PAYLOAD_TOO_LARGE",
  }));

  await page.goto("/");
  await page.locator('input[type="file"][accept*="audio"]').setInputFiles(wavFile(60));

  const panel = page.getByTestId("clip-quote-error");
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("dépasse la taille que le serveur accepte");
  await expect(panel).toContainText("Mo");
  await expect(panel, "l’erreur de parsing brute ne doit pas fuir").not.toContainText("JSON");
  await expect(page.getByTestId("clip-primary-action")).toContainText("Prix indisponible");
});

test("le formulaire simple reste lisible sur téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: null }) }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Créez votre clip jusqu’à 7 minutes" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
