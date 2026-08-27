import { expect, test, type Page } from "@playwright/test";
import { jpegFile, wavFile } from "./audio-fixture";

/**
 * Scénario « Réessayer » complet, joué dans le navigateur :
 * projet valide → crédits réservés → échec temporaire → message clair →
 * bouton Réessayer → fichiers conservés → une seule relance, sans second
 * débit → génération simulée terminée → MP4 téléchargeable.
 */

const PROJECT_ID = "project-retry-001";
const DOWNLOAD_URL = "/api/media/final-export-retry-001?token=test";

// 180 s facturées à la durée réelle : 3 000 crédits, soit 30,00 €.
const quote = {
  success: true, totalCredits: 3_000, requiredCredits: 3_000, priceEur: 30,
  audioDurationSeconds: 180, normalizedSeconds: 180, billableDurationSeconds: 180,
  plan: "TIKTOK", planName: "Formule Clip TikTok", supported: true,
  fitsSelectedPlan: true, recommendedPlan: null, maxPriceEur: 35,
  balance: 5_000, balanceAfter: 2_000, missingCredits: 0, missingPriceEur: 0,
  allowed: true, workerAvailable: true, refusalCode: null,
};

// MP4 minimal valide (boîte ftyp) : suffit à prouver le téléchargement.
const MP4 = Buffer.from("AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhtZGF0", "base64");

const jpeg = jpegFile;
const wav = wavFile(3);

/** Compteurs d'appels : ils prouvent l'absence de second débit et de double relance. */
type Counters = { retry: number; create: number; checkout: number; confirm: number };

async function setupJourney(page: Page) {
  const counters: Counters = { retry: 0, create: 0, checkout: 0, confirm: 0 };
  let statusPhase: "failed" | "completed" = "failed";

  // Le navigateur envoie désormais les gros médias directement à Vercel Blob.
  // Le scénario reste hermétique au réseau en simulant l'obtention du jeton,
  // puis la réponse du stockage pour chacun des deux fichiers.
  await page.route("**/api/simple-clips/uploads", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ clientToken: "vercel_blob_client_test-store_fake" }),
  }));
  await page.route("https://vercel.com/api/blob/**", (route) => {
    const pathname = new URL(route.request().url()).searchParams.get("pathname") || "rudyo-video-studio/test-file";
    const url = `https://test-store.public.blob.vercel-storage.com/${pathname}`;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ url, downloadUrl: `${url}?download=1`, pathname, contentType: route.request().headers()["content-type"] || "application/octet-stream", contentDisposition: "inline", etag: "test-etag" }),
    });
  });

  await page.route("**/api/session", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({
      success: true,
      user: { id: "user-retry", email: "artiste@example.com", name: "Artiste" },
      credits: { balance: 5_000, total: 5_000, used: 0 },
    }),
  }));

  await page.route("**/api/simple-clips/quote", (route) => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify(quote),
  }));

  // Toute tentative de paiement pendant la reprise serait un second débit.
  await page.route("**/api/stripe/checkout", (route) => {
    counters.checkout += 1;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ url: "/paiement-interdit" }) });
  });

  await page.route(`**/api/simple-clips/${PROJECT_ID}/retry`, (route) => {
    counters.retry += 1;
    statusPhase = "completed";
    return route.fulfill({
      status: 202, contentType: "application/json",
      body: JSON.stringify({ success: true, projectId: PROJECT_ID, workerJobId: "job-1", reused: true, charged: false }),
    });
  });

  await page.route(`**/api/simple-clips/${PROJECT_ID}/confirm`, (route) => {
    counters.confirm += 1;
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.route(`**/api/simple-clips/${PROJECT_ID}`, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify(statusPhase === "failed"
      ? { success: true, state: "failed", progress: 100, message: "La création s’est interrompue pendant le montage. Vos crédits restent réservés pour ce projet." }
      : {
          success: true, state: "completed", progress: 100, message: "Votre clip est prêt !",
          videoUrl: `${DOWNLOAD_URL}&preview=1`, downloadUrl: DOWNLOAD_URL,
          projectTitle: "Mon clip Rudyo", durationSeconds: 180, createdAt: new Date("2026-08-26").toISOString(),
        }),
  }));

  // Création du projet : les crédits sont réservés côté serveur à cet instant.
  await page.route("**/api/simple-clips", (route) => {
    if (route.request().method() !== "POST") return route.continue();
    counters.create += 1;
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ projectId: PROJECT_ID, reserved: true, credits: 3_000 }) });
  });

  await page.route(`**${DOWNLOAD_URL.split("?")[0]}*`, (route) => route.fulfill({
    status: 200, contentType: "video/mp4", body: MP4,
    headers: { "Content-Disposition": 'attachment; filename="clip.mp4"' },
  }));

  return counters;
}

async function fillForm(page: Page) {
  await page.goto("/");
  await page.locator('input[type="file"][accept*="image"]').setInputFiles(jpeg);
  await page.locator('input[type="file"][accept*="audio"]').setInputFiles(wav);
  await page.getByRole("textbox", { name: /idée|Mon idée/i }).or(page.locator("textarea")).first()
    .fill("Une chanteuse traverse une ville la nuit sous les néons.");
  await expect(page.getByTestId("clip-quote")).toContainText("Durée détectée");
}

test("le bouton Réessayer relance une seule fois, sans second débit, jusqu’au téléchargement", async ({ page }) => {
  const counters = await setupJourney(page);

  // 1-2. Projet déjà créé et crédits réservés côté serveur : on reprend le suivi
  // comme le ferait un retour sur la page, sans rejouer le téléversement.
  await page.addInitScript((id) => window.localStorage.setItem("rudyo-active-simple-clip", id), PROJECT_ID);
  await page.goto("/");

  // 3-4. Échec temporaire, message compréhensible.
  await expect(page.getByRole("heading", { name: "Nous n’avons pas pu terminer ce clip" })).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "interrompue" })).toContainText("Vos crédits restent réservés");

  // 5-6. Bouton Réessayer et promesse explicite de conservation.
  const retryButton = page.getByTestId("clip-retry");
  await expect(retryButton).toBeVisible();
  await expect(retryButton).toHaveText("Réessayer");
  await expect(page.getByText("Votre photo, votre musique et votre idée sont conservées.", { exact: false })).toBeVisible();

  // 7-8. Double clic synchrone : une seule relance doit partir.
  await retryButton.evaluate((element: HTMLElement) => { element.click(); element.click(); });

  // 9. Génération simulée terminée.
  await expect(page.getByRole("heading", { name: "Votre clip est prêt !" })).toBeVisible({ timeout: 15_000 });
  expect(counters.retry, "une seule tâche relancée malgré le double clic").toBe(1);
  expect(counters.checkout, "aucune session de paiement pendant la reprise").toBe(0);
  expect(counters.create, "aucun second projet créé").toBe(0);

  // 10. MP4 téléchargeable.
  const download = page.getByRole("link", { name: /Télécharger mon clip/i });
  await expect(download).toHaveAttribute("href", DOWNLOAD_URL);
  await expect(download, "le lien enregistre le fichier au lieu de naviguer").toHaveAttribute("download", "");

  // Récupération depuis le contexte de la page : le MP4 est bien servi.
  const fetched = await page.evaluate(async (url) => {
    const response = await fetch(url);
    return { status: response.status, type: response.headers.get("content-type"), size: (await response.arrayBuffer()).byteLength };
  }, DOWNLOAD_URL);
  expect(fetched.status).toBe(200);
  expect(fetched.type).toContain("video/mp4");
  expect(fetched.size).toBe(MP4.length);
});

test("après un échec, la photo, la musique et l’idée restent dans le formulaire", async ({ page }) => {
  await setupJourney(page);
  await fillForm(page);

  await page.getByTestId("clip-primary-action").click();
  await expect(page.getByTestId("clip-retry")).toBeVisible();

  // Retour au formulaire : rien n’a été effacé.
  await page.getByRole("button", { name: "Modifier mon idée" }).click();
  await expect(page.locator("textarea")).toHaveValue(/chanteuse traverse une ville/);
  await expect(page.getByText("artiste.jpg")).toBeVisible();
  await expect(page.getByText(/chanson\.wav/)).toBeVisible();
  await expect(page.getByTestId("clip-quote")).toContainText("Durée détectée");
});
