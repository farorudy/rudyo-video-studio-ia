const BASE_URL = process.env.RUDYO_PRODUCTION_URL || "https://rudyoai.com";
// 4 kHz keeps a seven-minute PCM fixture below Vercel's request-body limit.
// The number of samples still encodes the requested duration exactly.
const SAMPLE_RATE = 4_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;

const expectations = [
  { seconds: 210, normalizedSeconds: 210, selectedPlan: "TIKTOK", resultPlan: "TIKTOK", credits: 3_500, supported: true, fitsSelectedPlan: true },
  { seconds: 240, normalizedSeconds: 240, selectedPlan: "TIKTOK", resultPlan: "TIKTOK", credits: 3_500, supported: true, fitsSelectedPlan: false },
  { seconds: 240, normalizedSeconds: 240, selectedPlan: "LONG", resultPlan: "LONG", credits: 5_000, supported: true, fitsSelectedPlan: true },
  { seconds: 360, normalizedSeconds: 360, selectedPlan: "PREMIUM", resultPlan: "PREMIUM", credits: 7_000, supported: true, fitsSelectedPlan: true },
  { seconds: 421, normalizedSeconds: 421, selectedPlan: "PREMIUM", resultPlan: "CUSTOM", credits: 0, supported: false, fitsSelectedPlan: false },
];

function syntheticWav(seconds) {
  const sampleCount = seconds * SAMPLE_RATE;
  const dataBytes = sampleCount * CHANNELS * (BITS_PER_SAMPLE / 8);
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataBytes, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(CHANNELS, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * CHANNELS * (BITS_PER_SAMPLE / 8), 28);
  buffer.writeUInt16LE(CHANNELS * (BITS_PER_SAMPLE / 8), 32);
  buffer.writeUInt16LE(BITS_PER_SAMPLE, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataBytes, 40);
  return buffer;
}

const results = [];
for (const expected of expectations) {
  const form = new FormData();
  form.set("audio", new Blob([syntheticWav(expected.seconds)], { type: "audio/wav" }), `synthetic-${expected.seconds}s.wav`);
  form.set("audioStartSeconds", "0");
  form.set("plan", expected.selectedPlan);
  const response = await fetch(`${BASE_URL}/api/simple-clips/quote`, { method: "POST", body: form });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : { error: await response.text() };
  const actual = { status: response.status, normalizedSeconds: body.normalizedSeconds, plan: body.plan, credits: body.totalCredits, priceEur: body.priceEur, supported: body.supported, fitsSelectedPlan: body.fitsSelectedPlan, workerAvailable: body.workerAvailable };
  const passed = response.ok && actual.normalizedSeconds === expected.normalizedSeconds && actual.plan === expected.resultPlan && actual.credits === expected.credits && actual.supported === expected.supported && actual.fitsSelectedPlan === expected.fitsSelectedPlan;
  results.push({ inputSeconds: expected.seconds, ...actual, passed });
}

console.log(JSON.stringify({ baseUrl: BASE_URL, results }, null, 2));
if (results.some((result) => !result.passed)) process.exitCode = 1;
