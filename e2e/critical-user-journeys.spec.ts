import { expect, test } from "@playwright/test";

test("la vraie page d’accueil expose la navigation Rudyo AI et uniquement l’OTP", async ({ page }) => {
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) }));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Rudyo AI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Se connecter", exact: true }).first()).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Créer un compte", exact: true }).first()).toHaveAttribute("href", "/inscription");
  await expect(page.getByText("Créez votre compte et commencez votre premier clip avec Rudyo AI.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Session Rudyo" })).toHaveCount(0);
  await expect(page.locator('form input[type="email"]')).toHaveCount(0);
});

test("l’accueil connecté masque l’authentification et affiche le compte", async ({ page }) => {
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.goto("/");
  const navigation = page.getByRole("navigation");
  await expect(navigation.getByRole("link", { name: "Se connecter", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("link", { name: "Créer un compte", exact: true })).toHaveCount(0);
  await expect(navigation.getByRole("button", { name: "Déconnexion" })).toBeVisible();
  await expect(navigation.getByText(/20 crédits/)).toBeVisible();
});

test("un utilisateur connecté est redirigé de l’inscription vers le Dashboard", async ({ page }) => {
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [] }) }));
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) }));
  await page.route("**/api/credits/balance", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, creditsRemaining: 20 }) }));
  await page.goto("/inscription");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("la route Crédits reste exclusivement la page d’achat", async ({ page }) => {
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) }));
  await page.goto("/credits");
  await expect(page.getByRole("heading", { name: "Choisissez votre pack Rudyo." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Inscription gratuite" })).toHaveCount(0);
});

test("l’inscription exige la vérification du code OTP", async ({ page }) => {
  let requestedIdentity: unknown;
  let verifiedChallenge: unknown;
  await page.route(/\/api\/session$/, async (route) => {
    if (route.request().method() === "GET") return route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) });
    requestedIdentity = route.request().postDataJSON();
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, challengeRequired: true }) });
  });
  await page.route(/\/api\/auth\/verify$/, async (route) => {
    verifiedChallenge = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  await page.goto("/inscription");
  await page.getByLabel("Nom complet").fill("Artiste Test");
  await page.getByLabel("Adresse e-mail").fill("artiste@example.com");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Créer mon compte gratuitement" }).click();
  await expect(page.getByLabel("Code à six chiffres")).toBeVisible();
  await page.getByLabel("Code à six chiffres").fill("123456");
  await page.getByRole("button", { name: "Vérifier et continuer" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect(requestedIdentity).toMatchObject({ email: "artiste@example.com", name: "Artiste Test" });
  expect(verifiedChallenge).toEqual({ email: "artiste@example.com", otp: "123456" });
});

test("la connexion OTP vérifie le code avant d’ouvrir le Studio", async ({ page }) => {
  let authenticated = false;
  await page.route(/\/api\/session$/, async (route) => {
    if (route.request().method() === "GET") {
      return authenticated
        ? route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "connexion@example.com", name: "Artiste" }, credits: { balance: 20 } }) })
        : route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) });
    }
    return route.fulfill({ status: 202, contentType: "application/json", body: JSON.stringify({ success: true, challengeRequired: true }) });
  });
  await page.route(/\/api\/auth\/verify$/, (route) => {
    authenticated = true;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });
  await page.goto("/login");
  await page.getByLabel("Adresse e-mail").fill("connexion@example.com");
  await page.getByRole("button", { name: "Recevoir mon code sécurisé" }).click();
  await page.getByLabel("Code à six chiffres").fill("123456");
  await page.getByRole("button", { name: "Vérifier et me connecter" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("la création Seedance apparaît immédiatement sans génération BytePlus", async ({ page }) => {
  const project = { id: "project-created", title: "Clip sans crédit", artistName: "Artiste Test", finalFormat: "16:9", demoMode: true, scenes: [], mediaAssets: [], consentRecords: [] };
  let projects: typeof project[] = [];
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/seedance/models", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models: [], mode: "demo" }) }));
  await page.route("**/api/seedance/projects", async (route) => {
    if (route.request().method() === "POST") {
      projects = [project];
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, project }) });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects }) });
  });
  await page.route("**/api/seedance/projects/project-created", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, project }) }));
  await page.goto("/studio-clip-seedance");
  await page.getByLabel("Titre de la chanson").fill(project.title);
  await page.getByLabel("Nom de l’artiste").fill(project.artistName);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByText("Projet musical créé.")).toBeVisible();
  await expect(page.getByRole("button", { name: /Clip sans crédit/ })).toBeVisible();
});

test("un utilisateur authentifié importe un fichier local avec progression", async ({ page }) => {
  const asset = { id: "asset-1", type: "ARTIST_PORTRAIT", fileName: "artiste.png", mimeType: "image/png", sizeBytes: 68 };
  let persistedAssets: typeof asset[] = [];
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/credits/balance", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, creditsRemaining: 20 }) }));
  await page.route("**/api/seedance/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [{ id: "project-1", title: "Mon clip", artistName: "Rudyo" }] }) }));
  await page.route("**/api/seedance/projects/project-1", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, project: { id: "project-1", mediaAssets: persistedAssets } }) }));
  await page.route("**/api/seedance/projects/project-1/media", async (route) => {
    expect(route.request().method()).toBe("POST");
    persistedAssets = [asset];
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ success: true, asset }) });
  });
  await page.route("**/api/projects/project-1/assets/asset-1/download*", (route) => route.fulfill({ status: 200, contentType: "image/png", body: Buffer.from("89504e470d0a1a0a", "hex") }));
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) }));
  await page.goto("/studio");
  const input = page.locator('input[type="file"][accept*="image/png"]').first();
  await expect(input).toBeAttached();
  await input.setInputFiles({ name: "artiste.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await expect(page.getByText("Prêt à importer")).toBeVisible();
  await page.getByRole("button", { name: "Importer 1 fichier" }).click();
  await expect(page.locator('section[aria-labelledby="computer-import-title"]').getByText("Importé", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Aperçu de artiste.png" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("img", { name: "Aperçu de artiste.png" })).toBeVisible();
  const mediaDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger artiste.png" }).click();
  const downloadedMedia = await mediaDownload;
  expect(downloadedMedia.suggestedFilename()).toBe("artiste.png");
  const mediaStream = await downloadedMedia.createReadStream();
  const mediaChunks: Buffer[] = [];
  for await (const chunk of mediaStream) mediaChunks.push(Buffer.from(chunk));
  expect(Buffer.concat(mediaChunks).length).toBeGreaterThan(0);
});

test("la page Projets affiche le projet Seedance sans parcourir Blob", async ({ page }) => {
  const asset = { id: "asset-1", type: "ARTIST_PORTRAIT", fileName: "artiste.png", mimeType: "image/png", sizeBytes: 8 };
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [{ id: "project-1", title: "TEST QA Import Téléchargement", artistName: "Rudyo", category: "Studio Clip Seedance", status: "DRAFT", savedAt: new Date().toISOString(), counts: { scenes: 0, generationTasks: 0, mediaAssets: 1, finalExports: 0 }, mediaAssets: [asset] }] }) }));
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) }));
  await page.route("**/api/projects/project-1/assets/asset-1/download*", (route) => route.fulfill({ status: 200, contentType: "image/png", headers: { "Content-Disposition": "attachment; filename=\"artiste.png\"" }, body: Buffer.from("89504e470d0a1a0a", "hex") }));
  await page.goto("/projects");
  await expect(page.getByRole("heading", { name: "TEST QA Import Téléchargement" })).toBeVisible();
  await expect(page.getByText("Chemin de stockage invalide.")).toHaveCount(0);
  await expect(page.getByText(/1 média/)).toBeVisible();
});

test("l’historique JSON est téléchargé avec un nom et un contenu valides", async ({ page }) => {
  const project = { id: "project-1", title: "Mon clip", artistName: "Rudyo", finalFormat: "16:9", demoMode: true, scenes: [], mediaAssets: [], consentRecords: [] };
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/seedance/models", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ models: [], mode: "demo" }) }));
  await page.route("**/api/seedance/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [project] }) }));
  await page.route("**/api/seedance/projects/project-1", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, project }) }));
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) }));
  await page.route("**/api/projects/project-1/history/download", (route) => route.fulfill({ status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=\"rudyo-historique-project-1.json\"" }, body: JSON.stringify({ success: true, usage: [] }) }));
  await page.goto("/studio-clip-seedance?project=project-1");
  const historyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger l’historique JSON rudyo-historique-project-1.json" }).click();
  const history = await historyDownload;
  expect(history.suggestedFilename()).toBe("rudyo-historique-project-1.json");
  const stream = await history.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString("utf8"))).toMatchObject({ success: true });
});

test("une réponse d’import vide ne laisse jamais l’interface bloquée", async ({ page }) => {
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/credits/balance", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, creditsRemaining: 20 }) }));
  await page.route("**/api/seedance/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [{ id: "project-1", title: "Mon clip", artistName: "Rudyo" }] }) }));
  await page.route("**/api/seedance/projects/project-1", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, project: { id: "project-1", mediaAssets: [] } }) }));
  await page.route("**/api/seedance/projects/project-1/media", (route) => route.fulfill({ status: 502, contentType: "text/html", body: "" }));
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) }));
  await page.goto("/studio");
  await page.locator('input[type="file"][accept*="image/png"]').first().setInputFiles({ name: "artiste.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a", "hex") });
  await page.getByRole("button", { name: "Importer 1 fichier" }).click();
  await expect(page.getByText("Import impossible (502).", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Recommencer artiste.png" })).toBeVisible();
  await expect(page.getByText(/Importation \d+ %/)).toHaveCount(0);
});

test("le Dashboard compte immédiatement le projet Seedance", async ({ page }) => {
  await page.route(/\/api\/session$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { id: "user-1", email: "artiste@example.com", name: "Artiste" }, credits: { balance: 20 } }) }));
  await page.route("**/api/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [{ id: "project-1", counts: { finalExports: 0 } }] }) }));
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [] }) }));
  await page.route("**/api/credits/balance", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, user: { email: "artiste@example.com", name: "Artiste", plan: "FREE" }, credits: { balance: 20, total: 20, used: 0 }, creditsRemaining: 20, creditsUsed: 0, plan: "FREE", monthlyLimit: 0, monthlyUsed: 0 }) }));
  await page.goto("/dashboard");
  const card = page.getByText("Projets", { exact: true }).locator("..");
  await expect(card.getByText("1", { exact: true })).toBeVisible();
});

test("un MP4 terminé déclenche un téléchargement nommé", async ({ page, context }) => {
  await page.route("**/api/results", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, results: [{ id: "result-1", projectId: "project-1", project: "Mon clip", name: "Export final", mimeType: "video/mp4", sizeBytes: 12, createdAt: new Date().toISOString(), status: "TERMINÉ" }] }) }));
  await page.route("**/api/projects", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, projects: [] }) }));
  await context.route("**/api/assets/result-1/download*", (route) => route.fulfill({ status: 200, headers: { "Content-Type": "video/mp4", "Content-Disposition": "attachment; filename=\"rudyo-mon-clip-export-final.mp4\"" }, body: Buffer.from("00000018667479706d703432", "hex") }));
  await page.goto("/projects");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Télécharger rudyo-export-final\.mp4/ }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("rudyo-mon-clip-export-final.mp4");
});
