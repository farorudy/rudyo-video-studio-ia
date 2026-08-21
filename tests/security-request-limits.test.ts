import assert from "node:assert/strict";
import test from "node:test";
import { readBodyWithLimit, RequestTooLargeError, sniffMime } from "../lib/request-limits";

test("Content-Length trop grand est refusé avant lecture", async () => {
  const request = new Request("https://rudyo.test/upload", {
    method: "POST",
    headers: { "Content-Length": "1001" },
    body: Buffer.alloc(10),
  });
  await assert.rejects(() => readBodyWithLimit(request, 1_000), RequestTooLargeError);
});

test("une lecture en flux dépassant la limite est interrompue", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(700));
      controller.enqueue(new Uint8Array(700));
      controller.close();
    },
  });
  const request = new Request("https://rudyo.test/upload", { method: "POST", body: stream, duplex: "half" } as RequestInit & { duplex: "half" });
  await assert.rejects(() => readBodyWithLimit(request, 1_000), RequestTooLargeError);
});

test("le type réel d’un fichier est détecté par sa signature", () => {
  const fakeMp4 = Buffer.from("ceci-n-est-pas-un-mp4");
  const realMp4 = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from("ftypisom"), Buffer.alloc(12)]);
  assert.equal(sniffMime(fakeMp4), null);
  assert.equal(sniffMime(realMp4), "video/mp4");
});
