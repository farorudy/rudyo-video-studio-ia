import { promises as fs } from "fs";
import { createReadStream } from "fs";
import { Readable } from "stream";
import path from "path";
import { del, get, list, put } from "@vercel/blob";

type StoragePutOptions = {
  contentType?: string;
  access?: "private";
};

export type StorageItem = {
  key: string;
  url?: string;
  size?: number;
  uploadedAt?: Date;
};

const MEDIA_ROOT = path.join(process.cwd(), "media");

// État global pour désactiver Vercel Blob si suspendu ou indisponible
let cloudStorageAvailable: boolean | null = null;

/**
 * Vérifie si une erreur provient de Vercel Blob (store suspendu, token invalide, etc.)
 */
function isVercelBlobError(error: unknown): boolean {
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

function normalizeKey(key: string) {
  const normalized = key.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  const segments = normalized.split("/");

  if (
    !normalized ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    segments.some((segment) => segment === ".." || segment === "")
  ) {
    throw new Error("Chemin de stockage invalide.");
  }

  return normalized;
}

function cloudPrefix() {
  const prefix = process.env.CLOUD_STORAGE_PREFIX?.trim();
  return prefix ? normalizeKey(prefix) : "rudyo-video-studio";
}

function toCloudPathname(key: string) {
  return `${cloudPrefix()}/${normalizeKey(key)}`;
}

function fromCloudPathname(pathname: string) {
  const root = `${cloudPrefix()}/`;
  return pathname.startsWith(root) ? pathname.slice(root.length) : pathname;
}

function toLocalPath(key: string) {
  const localPath = path.resolve(MEDIA_ROOT, normalizeKey(key));

  if (!localPath.startsWith(`${MEDIA_ROOT}${path.sep}`)) {
    throw new Error("Chemin de stockage hors media interdit.");
  }

  return localPath;
}

/**
 * Désactive le stockage cloud si Vercel Blob est indisponible
 */
export function disableCloudStorage(): void {
  cloudStorageAvailable = false;
  console.warn(
    "[Storage] Vercel Blob storage disabled due to error. " +
    "Falling back to local storage. Set BLOB_READ_WRITE_TOKEN to re-enable."
  );
}

/**
 * Vérifie si le stockage cloud est activé et disponible
 */
export function isCloudStorageEnabled(): boolean {
  // Si explicitement désactivé suite à une erreur, on ne réessaye pas
  if (cloudStorageAvailable === false) {
    return false;
  }
  
  // Si pas de token, le cloud storage n'est pas activé
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return false;
  }
  
  // Par défaut, on considère que c'est disponible
  return true;
}

export function toClientFileRef(key: string, publicUrl?: string) {
  if (isCloudStorageEnabled() && publicUrl) {
    return publicUrl;
  }

  return `media/${normalizeKey(key)}`;
}

async function findCloudBlobByKey(key: string) {
  const pathname = toCloudPathname(key);
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1000 });
    return blobs.find((blob) => blob.pathname === pathname);
  } catch (error) {
    if (isVercelBlobError(error)) {
      disableCloudStorage();
    }
    throw error;
  }
}

export async function putStorageBuffer(
  key: string,
  buffer: Buffer,
  options: StoragePutOptions = {},
) {
  const normalized = normalizeKey(key);

  if (isCloudStorageEnabled()) {
    try {
      const blob = await put(toCloudPathname(normalized), buffer, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: options.contentType,
      });

      return {
        key: normalized,
        url: blob.url,
      };
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        // Fallback vers le stockage local
        console.warn("[Storage] putStorageBuffer: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        const localPath = toLocalPath(normalized);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, buffer);
        return {
          key: normalized,
          url: undefined,
        };
      }
      throw error;
    }
  }

  const localPath = toLocalPath(normalized);
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, buffer);

  return {
    key: normalized,
    url: undefined,
  };
}

export async function putStorageText(
  key: string,
  text: string,
  options: StoragePutOptions = {},
) {
  const contentType = options.contentType || "text/plain; charset=utf-8";
  return putStorageBuffer(key, Buffer.from(text, "utf8"), { contentType });
}

export async function readStorageBuffer(key: string) {
  const normalized = normalizeKey(key);

  if (isCloudStorageEnabled()) {
    try {
      const blob = await findCloudBlobByKey(normalized);

      if (!blob) {
        return null;
      }

      const privateBlob = await get(blob.pathname, {
        access: "private",
        useCache: false,
      });
      if (!privateBlob || privateBlob.statusCode !== 200) {
        throw new Error("Impossible de lire le blob privé.");
      }
      return Buffer.from(await new Response(privateBlob.stream).arrayBuffer());
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        console.warn("[Storage] readStorageBuffer: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        try {
          return await fs.readFile(toLocalPath(normalized));
        } catch (localError) {
          if ((localError as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
          }
          throw localError;
        }
      }
      throw error;
    }
  }

  try {
    return await fs.readFile(toLocalPath(normalized));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export function storageKeyFromClientRef(value?: string | null) {
  if (!value) return null;
  if (value.startsWith("media/")) return normalizeKey(value.slice("media/".length));
  if (!isCloudStorageEnabled()) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || !url.hostname.endsWith(".blob.vercel-storage.com")) return null;
    const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    const prefix = `${cloudPrefix()}/`;
    return pathname.startsWith(prefix) ? normalizeKey(pathname.slice(prefix.length)) : null;
  } catch {
    return null;
  }
}

export async function openStorageStream(key: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  size?: number;
  contentLength?: number;
} | null> {
  const normalized = normalizeKey(key);

  if (isCloudStorageEnabled()) {
    try {
      const blob = await findCloudBlobByKey(normalized);
      if (!blob) return null;
      const result = await get(blob.pathname, { access: "private", useCache: false });
      if (!result || result.statusCode !== 200) return null;
      return { stream: result.stream, size: blob.size, contentLength: blob.size };
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        console.warn("[Storage] openStorageStream: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        try {
          const localPath = toLocalPath(normalized);
          const stats = await fs.stat(localPath);
          return {
            stream: Readable.toWeb(createReadStream(localPath)) as ReadableStream<Uint8Array>,
            size: stats.size,
            contentLength: stats.size,
          };
        } catch (localError) {
          if ((localError as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw localError;
        }
      }
      throw error;
    }
  }

  try {
    const localPath = toLocalPath(normalized);
    const stats = await fs.stat(localPath);
    return {
      stream: Readable.toWeb(createReadStream(localPath)) as ReadableStream<Uint8Array>,
      size: stats.size,
      contentLength: stats.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function getStorageSize(key: string) {
  const normalized = normalizeKey(key);
  if (isCloudStorageEnabled()) {
    try {
      return (await findCloudBlobByKey(normalized))?.size ?? null;
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        console.warn("[Storage] getStorageSize: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        try { return (await fs.stat(toLocalPath(normalized))).size; }
        catch (localError) {
          if ((localError as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw localError;
        }
      }
      throw error;
    }
  }
  try { return (await fs.stat(toLocalPath(normalized))).size; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function openStorageRange(key: string, start: number, end: number): Promise<{
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentLength: number;
} | null> {
  const normalized = normalizeKey(key);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) throw new Error("Plage de stockage invalide.");
  if (isCloudStorageEnabled()) {
    try {
      const blob = await findCloudBlobByKey(normalized);
      if (!blob || start >= blob.size) return null;
      const boundedEnd = Math.min(end, blob.size - 1);
      const result = await get(blob.pathname, { access: "private", useCache: false, headers: { Range: `bytes=${start}-${boundedEnd}` } });
      if (!result || ![200, 206].includes(result.statusCode as number) || !result.stream) return null;
      return { stream: result.stream, size: blob.size, contentLength: boundedEnd - start + 1 };
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        console.warn("[Storage] openStorageRange: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        try {
          const localPath = toLocalPath(normalized);
          const stats = await fs.stat(localPath);
          if (start >= stats.size) return null;
          const boundedEnd = Math.min(end, stats.size - 1);
          return { stream: Readable.toWeb(createReadStream(localPath, { start, end: boundedEnd })) as ReadableStream<Uint8Array>, size: stats.size, contentLength: boundedEnd - start + 1 };
        } catch (localError) {
          if ((localError as NodeJS.ErrnoException).code === "ENOENT") return null;
          throw localError;
        }
      }
      throw error;
    }
  }
  try {
    const localPath = toLocalPath(normalized);
    const stats = await fs.stat(localPath);
    if (start >= stats.size) return null;
    const boundedEnd = Math.min(end, stats.size - 1);
    return { stream: Readable.toWeb(createReadStream(localPath, { start, end: boundedEnd })) as ReadableStream<Uint8Array>, size: stats.size, contentLength: boundedEnd - start + 1 };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function readStorageText(key: string) {
  const buffer = await readStorageBuffer(key);
  return buffer ? buffer.toString("utf8") : null;
}

export async function listStorage(prefix: string): Promise<StorageItem[]> {
  const normalizedPrefix = normalizeKey(prefix);

  if (isCloudStorageEnabled()) {
    try {
      let cursor: string | undefined;
      const items: StorageItem[] = [];

      do {
        const response = await list({
          prefix: toCloudPathname(normalizedPrefix),
          cursor,
          limit: 1000,
        });

        items.push(
          ...response.blobs.map((blob) => ({
            key: fromCloudPathname(blob.pathname),
            url: blob.url,
            size: blob.size,
            uploadedAt: blob.uploadedAt,
          })),
        );

        cursor = response.hasMore ? response.cursor : undefined;
      } while (cursor);

      return items;
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        console.warn("[Storage] listStorage: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        const localDir = toLocalPath(normalizedPrefix);
        try {
          const entries = await fs.readdir(localDir, { withFileTypes: true });
          const files = entries.filter((entry) => entry.isFile());

          return Promise.all(
            files.map(async (entry) => {
              const filePath = path.join(localDir, entry.name);
              const stats = await fs.stat(filePath);

              return {
                key: normalizeKey(path.posix.join(normalizedPrefix, entry.name)),
                size: stats.size,
                uploadedAt: stats.mtime,
              } satisfies StorageItem;
            }),
          );
        } catch (localError) {
          if ((localError as NodeJS.ErrnoException).code === "ENOENT") {
            return [];
          }
          throw localError;
        }
      }
      throw error;
    }
  }

  const localDir = toLocalPath(normalizedPrefix);

  try {
    const entries = await fs.readdir(localDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());

    return Promise.all(
      files.map(async (entry) => {
        const filePath = path.join(localDir, entry.name);
        const stats = await fs.stat(filePath);

        return {
          key: normalizeKey(path.posix.join(normalizedPrefix, entry.name)),
          size: stats.size,
          uploadedAt: stats.mtime,
        } satisfies StorageItem;
      }),
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

export async function deleteStorage(key: string) {
  const normalized = normalizeKey(key);

  if (isCloudStorageEnabled()) {
    try {
      const blob = await findCloudBlobByKey(normalized);

      if (!blob) {
        return false;
      }

      await del(blob.url);
      return true;
    } catch (error) {
      if (isVercelBlobError(error)) {
        disableCloudStorage();
        console.warn("[Storage] deleteStorage: Vercel Blob error, falling back to local storage");
      }
      // Si le cloud storage a été désactivé, on retente en local
      if (!isCloudStorageEnabled()) {
        try {
          await fs.unlink(toLocalPath(normalized));
          return true;
        } catch (localError) {
          if ((localError as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
          }
          throw localError;
        }
      }
      throw error;
    }
  }

  try {
    await fs.unlink(toLocalPath(normalized));
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return false;
    }

    throw error;
  }
}
