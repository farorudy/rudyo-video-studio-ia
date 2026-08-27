import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:3000";
const databaseURL = process.env.DATABASE_URL || "";
const authSecret = process.env.AUTH_SECRET || "";
if (!databaseURL.includes("127.0.0.1:55432/rudyo_worker_local")) throw new Error("DATABASE_URL locale isolée requise.");
if (authSecret.length < 32) throw new Error("AUTH_SECRET local requis.");

const prisma = new PrismaClient();
const browser = await chromium.launch({ headless: true });
const fixtureRoot = path.resolve("media", "local-test-fixtures");
const resultRoot = path.resolve("media", "local-test-results");
await mkdir(resultRoot, { recursive: true });
const photo = path.join(fixtureRoot, "portrait-synthetique.png");
const audio = path.join(fixtureRoot, "audio-15s.m4a");
const prompt = "Crée un clip romantique et cinématographique en Guadeloupe. La chanteuse marche sur une plage au lever du soleil, puis chante face à la mer.";
const consoleErrors = [];

async function authenticatedContext(email) {
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHmac("sha256", authSecret).update(`session:${rawToken}`, "utf8").digest("hex");
  await prisma.authSession.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60_000) } });
  const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: "rudyo_session", value: rawToken, url: baseURL, httpOnly: true, sameSite: "Strict" }]);
  return { context, user };
}

async function fillClipForm(page) {
  await page.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(await page.locator("[data-nextjs-dialog]").count(), 0, "Aucun overlay Next.js attendu");
  await page.getByRole("heading", { name: "Choisissez votre formule" }).waitFor();
  await page.getByRole("heading", { name: "Ma photo" }).waitFor();
  await page.getByRole("heading", { name: "Ma musique" }).waitFor();
  await page.getByRole("heading", { name: "Mon idée de clip" }).waitFor();
  const inputs = page.locator('input[type="file"]');
  await inputs.nth(0).setInputFiles(photo);
  const quoteResponse = page.waitForResponse((response) => response.url().includes("/api/simple-clips/quote") && response.status() === 200);
  await inputs.nth(1).setInputFiles({ name: "audio-15s.m4a", mimeType: "audio/mp4", buffer: await readFile(audio) });
  await page.getByRole("textbox").fill(prompt);
  const response = await quoteResponse;
  const quote = await response.json();
  await page.getByText("Durée détectée : 0 min 15 s", { exact: false }).waitFor();
  return quote;
}

async function waitForResultAndDownload(page, fileName) {
  await page.getByRole("heading", { name: "Votre clip est prêt !" }).waitFor({ timeout: 180_000 });
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Télécharger mon clip sur mon ordinateur" }).click();
  const download = await downloadPromise;
  const target = path.join(resultRoot, fileName);
  await download.saveAs(target);
  const details = await stat(target);
  assert.ok(details.size > 1024, "Le MP4 téléchargé doit être non vide");
  return { target, sizeBytes: details.size };
}

const exact = await authenticatedContext("novice-exact@rudyo.test");
const exactPage = await exact.context.newPage();
exactPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
exactPage.on("pageerror", (error) => consoleErrors.push(error.message));
const exactQuote = await fillClipForm(exactPage);
assert.equal(exactQuote.workerAvailable, true);
assert.equal(exactQuote.totalCredits, 3_500);
const exactButton = exactPage.getByRole("button", { name: "Créer mon clip — 3 500 crédits" });
await exactButton.waitFor();
assert.equal(await exactButton.isEnabled(), true);
await exactButton.evaluate((button) => { button.click(); button.click(); });
const exactDownload = await waitForResultAndDownload(exactPage, "clip-solde-exact.mp4");
const exactDb = await prisma.user.findUniqueOrThrow({ where: { id: exact.user.id }, select: { creditsRemaining: true } });
const exactProjects = await prisma.videoProject.findMany({ where: { userId: exact.user.id }, include: { clipWorkerJobs: true, mediaAssets: true } });
assert.equal(exactProjects.length, 1);
assert.equal(exactProjects[0].clipWorkerJobs.length, 1, "Le double clic ne doit créer qu’une tâche");
assert.equal(exactDb.creditsRemaining, 0);
await exactPage.screenshot({ path: path.join(resultRoot, "parcours-solde-exact.png"), fullPage: true });
await exact.context.close();

const insufficient = await authenticatedContext("novice-insufficient@rudyo.test");
const insufficientPage = await insufficient.context.newPage();
insufficientPage.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
insufficientPage.on("pageerror", (error) => consoleErrors.push(error.message));
const insufficientQuote = await fillClipForm(insufficientPage);
assert.equal(insufficientQuote.missingCredits, 3_400);
const buyButton = insufficientPage.getByRole("button", { name: /Payer .* et créer mon clip/ });
await buyButton.waitFor();
assert.equal(await buyButton.isEnabled(), true);
let mockCheckoutURL = "";
await insufficientPage.route("**/api/billing/mock-checkout**", async (route) => {
  mockCheckoutURL = route.request().url();
  await route.abort();
});
await buyButton.click();
for (let attempt = 0; attempt < 40 && !mockCheckoutURL; attempt += 1) await insufficientPage.waitForTimeout(250);
assert.ok(mockCheckoutURL.includes("/api/billing/mock-checkout"), "La recharge doit rester locale");
const draft = await prisma.videoProject.findFirstOrThrow({ where: { userId: insufficient.user.id }, orderBy: { createdAt: "desc" }, include: { mediaAssets: true } });
assert.equal(draft.status, "DRAFT");
assert.equal(draft.summary, prompt);
assert.equal(draft.mediaAssets.length, 2);
const firstWebhook = await insufficient.context.request.get(mockCheckoutURL, { maxRedirects: 0 });
const secondWebhook = await insufficient.context.request.get(mockCheckoutURL, { maxRedirects: 0 });
assert.equal(firstWebhook.status(), 307);
assert.equal(secondWebhook.status(), 307);
const credited = await prisma.user.findUniqueOrThrow({ where: { id: insufficient.user.id }, select: { creditsRemaining: true } });
assert.equal(credited.creditsRemaining, 3_500);
assert.equal(await prisma.transaction.count({ where: { userId: insufficient.user.id } }), 1);
assert.equal(await prisma.stripeWebhookEvent.count({ where: { stripeEventId: { startsWith: "evt_mock_" } } }), 1);
await insufficientPage.unroute("**/api/billing/mock-checkout**");
const resumeLocation = firstWebhook.headers().location;
assert.ok(resumeLocation);
await insufficientPage.goto(new URL(resumeLocation, baseURL).toString(), { waitUntil: "domcontentloaded" });
const insufficientDownload = await waitForResultAndDownload(insufficientPage, "clip-apres-recharge.mp4");
const insufficientProject = await prisma.videoProject.findUniqueOrThrow({ where: { id: draft.id }, include: { clipWorkerJobs: true, mediaAssets: true } });
assert.equal(insufficientProject.clipWorkerJobs.length, 1);
assert.equal(insufficientProject.mediaAssets.length, 2);
assert.equal(insufficientProject.summary, prompt);
const finalInsufficientBalance = await prisma.user.findUniqueOrThrow({ where: { id: insufficient.user.id }, select: { creditsRemaining: true } });
assert.equal(finalInsufficientBalance.creditsRemaining, 0);
await insufficientPage.screenshot({ path: path.join(resultRoot, "parcours-apres-recharge.png"), fullPage: true });
await insufficient.context.close();

const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.includes("status of 402 (Payment Required)"));
assert.deepEqual(unexpectedConsoleErrors, []);
console.log(JSON.stringify({
  pageLoaded: true,
  keyElementsRendered: true,
  errorOverlay: false,
  consoleErrors: unexpectedConsoleErrors.length,
  expectedPaymentRequiredResponses: consoleErrors.length - unexpectedConsoleErrors.length,
  workerAvailable: exactQuote.workerAvailable,
  exactCredits: exactQuote.totalCredits,
  exactJobs: exactProjects[0].clipWorkerJobs.length,
  duplicateWebhookCreditsGrantedOnce: true,
  exactDownload,
  insufficientDownload,
}));

await browser.close();
await prisma.$disconnect();
