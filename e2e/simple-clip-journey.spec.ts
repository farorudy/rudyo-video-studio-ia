import { expect, test } from "@playwright/test";

const quote = {
  success: true, totalCredits: 3_500, requiredCredits: 3_500, priceEur: 35,
  audioDurationSeconds: 180, normalizedSeconds: 180, billableDurationSeconds: 180,
  plan: "TIKTOK", planName: "Formule Clip TikTok", supported: true,
  fitsSelectedPlan: true, recommendedPlan: null, maxPriceEur: 35,
  balance: 5_000, balanceAfter: 1_500, missingCredits: 0, missingPriceEur: 0,
  allowed: true, workerAvailable: true, refusalCode: null,
};

test("le parcours commence par le choix explicite d’un pack fixe", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/api/simple-clips/quote", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(quote) }));
  await page.route("**/api/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ success: true, user: { id: "user-test", email: "debutant@example.com", name: "Débutant", creditsRemaining: 5_000 } }),
  }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Choisissez votre formule" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clip 3:30" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clip 5:00" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Clip 7:00" })).toBeVisible();
  await expect(page.getByText("3 500 crédits", { exact: true })).toBeVisible();
  await expect(page.getByText("5 000 crédits", { exact: true })).toBeVisible();
  await expect(page.getByText("7 000 crédits", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Choisir le clip 5 minutes — 50 €" }).click();
  await expect(page.getByRole("button", { name: "Formule sélectionnée" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ma photo" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ma musique" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Mon idée de clip" })).toBeVisible();
  await expect(page.getByText("Demander un devis", { exact: true })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("le formulaire simple reste lisible sur téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: null }) }));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Créez votre clip jusqu’à 7 minutes" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBe(false);
});
