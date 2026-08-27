import { constants, createReadStream, createWriteStream } from "node:fs";
import { access, copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { del, get, list, put } from "@vercel/blob";
import { config } from "./config.js";

export function normalizeStorageKey(value: string) {
  const key = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!key || key.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("STORAGE_KEY_INVALID");
  }
  return key;
}

function pathname(key: string) {
  return `${config.storagePrefix}/${normalizeStorageKey(key)}`;
}

function localPath(key: string) {
  const target = path.resolve(config.localStorageRoot, normalizeStorageKey(key));
  if (!target.startsWith(`${config.localStorageRoot}${path.sep}`)) throw new Error("STORAGE_KEY_INVALID");
  return target;
}

async function findBlob(key: string) {
  const target = pathname(key);
  const result = await list({ prefix: target, limit: 2, token: config.blobToken });
  return result.blobs.find((blob) => blob.pathname === target);
}

export async function downloadPrivateBlob(key: string, destination: string) {
  if (config.storageMockMode) {
    const source = localPath(key);
    const info = await stat(source).catch(() => null);
    if (!info?.isFile()) throw new Error("INPUT_NOT_FOUND");
    if (info.size > config.maxInputBytes) throw new Error("INPUT_TOO_LARGE");
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
    return info.size;
  }
  const blob = await findBlob(key);
  if (!blob) throw new Error("INPUT_NOT_FOUND");
  if (blob.size > config.maxInputBytes) throw new Error("INPUT_TOO_LARGE");
  const result = await get(blob.pathname, { access: "private", useCache: false, token: config.blobToken });
  if (!result || result.statusCode !== 200) throw new Error("INPUT_DOWNLOAD_FAILED");
  let bytes = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytes += chunk.length;
      callback(bytes > config.maxInputBytes ? new Error("INPUT_TOO_LARGE") : null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(result.stream as never), limiter, createWriteStream(destination, { flags: "wx", mode: 0o600 }));
  return bytes;
}

export async function uploadPrivateVideo(key: string, source: string) {
  const info = await stat(source);
  if (info.size <= 0 || info.size > config.maxOutputBytes) throw new Error("OUTPUT_SIZE_INVALID");
  if (config.storageMockMode) {
    const destination = localPath(key);
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
    await copyFile(source, destination);
    return { url: `local-private:${normalizeStorageKey(key)}` };
  }
  const body = Readable.toWeb(createReadStream(source)) as ReadableStream<Uint8Array>;
  return put(pathname(key), body, {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "video/mp4",
    token: config.blobToken,
  });
}

export async function checkStorage() {
  if (config.storageMockMode) {
    await mkdir(config.localStorageRoot, { recursive: true, mode: 0o700 });
    await access(config.localStorageRoot, constants.R_OK | constants.W_OK);
    return;
  }
  await list({ prefix: `${config.storagePrefix}/`, limit: 1, token: config.blobToken });
}

export async function deleteSystemTestPrefix(runId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(runId)) throw new Error("SYSTEM_TEST_ID_INVALID");
  if (config.storageMockMode) {
    await rm(localPath(`system-tests/${runId}`), { recursive: true, force: true });
    return;
  }
  const prefix = `${config.storagePrefix}/system-tests/${runId}/`;
  let cursor: string | undefined;
  do {
    const result = await list({ prefix, cursor, limit: 1000, token: config.blobToken });
    if (result.blobs.length) await del(result.blobs.map((blob) => blob.url), { token: config.blobToken });
    cursor = result.hasMore ? result.cursor : undefined;
  } while (cursor);
}
