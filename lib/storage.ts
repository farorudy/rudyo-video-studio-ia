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

export function isCloudStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

export function toClientFileRef(key: string, publicUrl?: string) {
  if (isCloudStorageEnabled() && publicUrl) {
    return publicUrl;
  }

  return `media/${normalizeKey(key)}`;
}

async function findCloudBlobByKey(key: string) {
  const pathname = toCloudPathname(key);
  const { blobs } = await list({ prefix: pathname, limit: 1000 });
  return blobs.find((blob) => blob.pathname === pathname);
}

export async function putStorageBuffer(
  key: string,
  buffer: Buffer,
  options: StoragePutOptions = {},
) {
  const normalized = normalizeKey(key);

  if (isCloudStorageEnabled()) {
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
} | null> {
  const normalized = normalizeKey(key);

  if (isCloudStorageEnabled()) {
    const blob = await findCloudBlobByKey(normalized);
    if (!blob) return null;
    const result = await get(blob.pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200) return null;
    return { stream: result.stream, size: blob.size };
  }

  try {
    const localPath = toLocalPath(normalized);
    const stats = await fs.stat(localPath);
    return {
      stream: Readable.toWeb(createReadStream(localPath)) as ReadableStream<Uint8Array>,
      size: stats.size,
    };
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
    const blob = await findCloudBlobByKey(normalized);

    if (!blob) {
      return false;
    }

    await del(blob.url);
    return true;
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
