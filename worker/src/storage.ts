import { constants, createReadStream, createWriteStream } from "node:fs";
import { access, copyFile, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { del, get, list, put } from "@vercel/blob";
import { config } from "./config.js";

/**
 * Vérifie si une erreur provient de Vercel Blob (store suspendu, token invalide, etc.)
 */
export function isVercelBlobError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  
  const errorObj = error as { message?: string; code?: string; statusCode?: number };
  const message = errorObj.message?.toLowerCase() || "";
  
  // Erreurs connues de Vercel Blob quand le store est suspendu
  return (
    message.includes("this store has been suspended") ||
    message.includes("store has been suspended") ||
    message.includes("blob store suspended") ||
    message.includes("forbidden") ||
    message.includes("unauthorized") ||
    errorObj.code === "FORBIDDEN" ||
    errorObj.code === "UNAUTHORIZED" ||
    errorObj.statusCode === 403 ||
    errorObj.statusCode === 401
  );
}

// Cache du contrôle de santé pendant 30 secondes
let storageHealthCache: { available: boolean; errorCode: string | null; checkedAt: number } | null = null;

/**
 * Résultat du contrôle de santé du stockage
 */
export type StorageHealth =
  | { available: true; code: "AVAILABLE" }
  | { available: false; code: "NOT_CONFIGURED" }
  | { available: false; code: "STORE_SUSPENDED" }
  | { available: false; code: "AUTHENTICATION_FAILED" }
  | { available: false; code: "QUOTA_EXCEEDED" }
  | { available: false; code: "UNREACHABLE" }
  | { available: false; code: "UNKNOWN" };

/**
 * Vérifie l'état de santé du stockage Vercel Blob
 * Utilise un objet technique réservé pour le test
 */
export async function getStorageHealth(): Promise<StorageHealth> {
  // Retourne le cache si valide (30 secondes)
  if (storageHealthCache && Date.now() - storageHealthCache.checkedAt < 30_000) {
    return storageHealthCache.errorCode === null
      ? { available: true, code: "AVAILABLE" }
      : { available: false, code: storageHealthCache.errorCode as any };
  }

  if (config.storageMockMode) {
    const result: StorageHealth = { available: true, code: "AVAILABLE" };
    storageHealthCache = { available: true, errorCode: null, checkedAt: Date.now() };
    return result;
  }

  // Pas de token configuré
  if (!config.blobToken) {
    const result: StorageHealth = { available: false, code: "NOT_CONFIGURED" };
    storageHealthCache = { available: false, errorCode: "NOT_CONFIGURED", checkedAt: Date.now() };
    return result;
  }

  // Objet technique pour le test de santé
  const testKey = "health/production-storage-check.txt";
  const testContent = "Storage health check - " + new Date().toISOString();
  const testPathname = `${config.storagePrefix}/${testKey}`;

  try {
    // Test minimal : écriture et lecture des métadonnées
    await put(testPathname, Buffer.from(testContent, "utf8"), {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "text/plain",
      token: config.blobToken,
    });

    // Lecture des métadonnées
    const listResult = await list({ 
      prefix: testPathname, 
      limit: 1, 
      token: config.blobToken 
    });
    
    const blob = listResult.blobs.find((b) => b.pathname === testPathname);
    if (!blob) {
      const result: StorageHealth = { available: false, code: "UNKNOWN" };
      storageHealthCache = { available: false, errorCode: "UNKNOWN", checkedAt: Date.now() };
      return result;
    }

    // Suppression du fichier de test
    await del(blob.url, { token: config.blobToken });

    const result: StorageHealth = { available: true, code: "AVAILABLE" };
    storageHealthCache = { available: true, errorCode: null, checkedAt: Date.now() };
    return result;
  } catch (error) {
    const errorCode = classifyStorageError(error) as StorageHealth["code"];
    const result: StorageHealth = { available: false, code: errorCode } as StorageHealth;
    storageHealthCache = { available: false, errorCode, checkedAt: Date.now() };
    return result;
  }
}

/**
 * Classifie une erreur de stockage en code standardisé
 */
export function classifyStorageError(error: unknown): string {
  if (!error || typeof error !== "object") return "UNKNOWN";
  
  const errorObj = error as { message?: string; code?: string; statusCode?: number };
  const message = errorObj.message?.toLowerCase() || "";
  
  // Check code and statusCode first
  if (errorObj.code === "FORBIDDEN" || errorObj.code === "UNAUTHORIZED" ||
      errorObj.statusCode === 403 || errorObj.statusCode === 401) {
    return "AUTHENTICATION_FAILED";
  }
  if (errorObj.code === "QUOTA_EXCEEDED" || errorObj.statusCode === 429) {
    return "QUOTA_EXCEEDED";
  }
  if (errorObj.code === "NETWORK_ERROR" || errorObj.code === "ETIMEDOUT") {
    return "UNREACHABLE";
  }
  
  // Then check message content
  if (message.includes("suspended")) return "STORE_SUSPENDED";
  if (message.includes("forbidden") || message.includes("unauthorized")) return "AUTHENTICATION_FAILED";
  if (message.includes("quota") || message.includes("limit")) return "QUOTA_EXCEEDED";
  if (message.includes("network") || message.includes("timeout")) return "UNREACHABLE";
  
  // If it's a Vercel Blob error but we couldn't classify it, default to STORE_SUSPENDED
  if (isVercelBlobError(error)) {
    return "STORE_SUSPENDED";
  }
  
  return "UNKNOWN";
}

/**
 * Invalide le cache de santé pour forcer une nouvelle vérification
 */
export function invalidateStorageHealthCache(): void {
  storageHealthCache = null;
}

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
  try {
    const result = await list({ prefix: target, limit: 2, token: config.blobToken });
    return result.blobs.find((blob) => blob.pathname === target);
  } catch (error) {
    // Si c'est une erreur de store suspendu, on la propage
    if (isVercelBlobError(error)) {
      const errorCode = classifyStorageError(error) as StorageHealth["code"];
      // Invalide le cache de santé
      invalidateStorageHealthCache();
      throw new Error(`STORAGE_${errorCode}`);
    }
    throw error;
  }
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
  try {
    const body = Readable.toWeb(createReadStream(source)) as ReadableStream<Uint8Array>;
    return put(pathname(key), body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "video/mp4",
      token: config.blobToken,
    });
  } catch (error) {
    // Si c'est une erreur de store suspendu, on la propage avec un code spécifique
    if (isVercelBlobError(error)) {
      const errorCode = classifyStorageError(error) as StorageHealth["code"];
      // Invalide le cache de santé
      invalidateStorageHealthCache();
      throw new Error(`STORAGE_${errorCode}`);
    }
    throw error;
  }
}

export async function checkStorage() {
  if (config.storageMockMode) {
    await mkdir(config.localStorageRoot, { recursive: true, mode: 0o700 });
    await access(config.localStorageRoot, constants.R_OK | constants.W_OK);
    return;
  }
  const health = await getStorageHealth();
  if (!health.available) {
    throw new Error(`STORAGE_${health.code}`);
  }
}

export async function deleteSystemTestPrefix(runId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(runId)) throw new Error("SYSTEM_TEST_ID_INVALID");
  if (config.storageMockMode) {
    await rm(localPath(`system-tests/${runId}`), { recursive: true, force: true });
    return;
  }
  const prefix = `${config.storagePrefix}/system-tests/${runId}/`;
  try {
    let cursor: string | undefined;
    do {
      const result = await list({ prefix, cursor, limit: 1000, token: config.blobToken });
      if (result.blobs.length) await del(result.blobs.map((blob) => blob.url), { token: config.blobToken });
      cursor = result.hasMore ? result.cursor : undefined;
    } while (cursor);
  } catch (error) {
    if (isVercelBlobError(error)) {
      const errorCode = classifyStorageError(error) as StorageHealth["code"];
      invalidateStorageHealthCache();
      throw new Error(`STORAGE_${errorCode}`);
    }
    throw error;
  }
}
