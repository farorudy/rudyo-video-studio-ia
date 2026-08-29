/**
 * Module serveur unique de stockage privé
 * Abstraction serveur-side pour le stockage avec Vercel Blob ou fallback local
 */

import { promises as fs } from 'fs';
import { createReadStream } from 'fs';
import { Readable } from 'stream';
import * as path from 'path';
import { del, get, list, put, type ListBlobResultBlob, type GetBlobResult } from '@vercel/blob';

// Types

export type StorageHealthCode = 'AVAILABLE' | 'NOT_CONFIGURED' | 'STORE_SUSPENDED' | 'AUTHENTICATION_FAILED' | 'QUOTA_EXCEEDED' | 'UNREACHABLE' | 'UNKNOWN';

export interface StorageHealth {
  available: true;
  code: 'AVAILABLE';
}

export interface StorageHealthUnavailable {
  available: false;
  code: Exclude<StorageHealthCode, 'AVAILABLE'>;
  error?: string;
  retryAfter?: number;
}

export type StorageHealthStatus = StorageHealth | StorageHealthUnavailable;

export interface StoredFile {
  key: string;
  url: string | null;
  size: number;
  contentType: string;
  uploadedAt: Date;
  checksum?: string;
}

export interface FileMetadata {
  key: string;
  size: number;
  contentType: string;
  uploadedAt: Date;
  checksum?: string;
}

export interface PutOptions {
  contentType?: string;
  maxAgeSeconds?: number;
  metadata?: Record<string, string>;
}

export interface StorageResult {
  key: string;
  url: string | null;
  size: number;
}

// Erreur personnalisée
export class StorageError extends Error {
  public readonly code: string;
  public readonly cause?: Error;

  constructor(code: string, message: string, cause?: Error) {
    super(message);
    this.name = 'StorageError';
    this.code = code;
    this.cause = cause;
  }
}

// ============================================================================
// Configuration
// ============================================================================

const MEDIA_ROOT = path.join(process.cwd(), 'media');
const STORAGE_PREFIX = process.env.CLOUD_STORAGE_PREFIX?.trim() || 'rudyo-video-studio';
const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const HEALTH_CHECK_OBJECT = 'health/production-storage-check.txt';
const HEALTH_CHECK_TTL_MS = 30000;
const MAX_FILE_SIZE = 100 * 1024 * 1024;
const OPERATION_TIMEOUT_MS = 30000;

// ============================================================================
// État du cache de santé
// ============================================================================

interface HealthCache {
  status: StorageHealthStatus;
  timestamp: number;
}

let healthCache: HealthCache | null = null;

// ============================================================================
// Validation des chemins
// ============================================================================

function normalizeAndValidateKey(rawKey: string): string {
  const normalized = rawKey.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
  const segments = normalized.split('/');

  if (
    !normalized ||
    normalized.startsWith('../') ||
    normalized.includes('/../') ||
    segments.some((segment) => segment === '..' || segment === '')
  ) {
    throw new Error('STORAGE_KEY_INVALID: Path traversal detected');
  }

  if (segments.length > 0) {
    const firstSegment = segments[0];
    if (firstSegment === 'health') return normalized;
    if (firstSegment === 'users' && segments.length >= 2 && segments[1].length >= 1) return normalized;
    if (firstSegment === 'projects' && segments.length >= 2 && segments[1].length >= 1) return normalized;
    if (firstSegment === 'videos' && segments.length >= 2 && segments[1].length >= 1) return normalized;
    if (firstSegment === 'system-tests' && segments.length >= 2 && /^[a-f0-9-]{36}$/i.test(segments[1])) return normalized;
  }

  throw new Error('STORAGE_KEY_INVALID: Unrecognized path format');
}

function toCloudPathname(key: string): string {
  return `${STORAGE_PREFIX}/${key}`;
}

function toLocalPath(key: string): string {
  const localPath = path.resolve(MEDIA_ROOT, key);
  if (!localPath.startsWith(`${MEDIA_ROOT}${path.sep}`)) {
    throw new Error('STORAGE_KEY_INVALID: Path escapes media directory');
  }
  return localPath;
}

// ============================================================================
// Gestion des erreurs Vercel Blob
// ============================================================================

function getVercelBlobErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return 'UNKNOWN';
  const errorObj = error as { message?: string; code?: string; statusCode?: number };
  const message = errorObj.message?.toLowerCase() || '';

  if (message.includes('this store has been suspended') || message.includes('store has been suspended') || message.includes('blob store suspended')) {
    return 'STORE_SUSPENDED';
  }
  if (message.includes('forbidden') || message.includes('unauthorized') || errorObj.code === 'FORBIDDEN' || errorObj.code === 'UNAUTHORIZED' || errorObj.statusCode === 403 || errorObj.statusCode === 401) {
    return 'AUTHENTICATION_FAILED';
  }
  if (message.includes('quota exceeded') || message.includes('rate limit') || message.includes('storage limit') || errorObj.code === 'QUOTA_EXCEEDED' || errorObj.statusCode === 429) {
    return 'QUOTA_EXCEEDED';
  }
  if (message.includes('connection refused') || message.includes('network error') || message.includes('unreachable') || errorObj.code === 'ECONNREFUSED' || errorObj.code === 'ENOTFOUND') {
    return 'UNREACHABLE';
  }
  return 'UNKNOWN';
}

// ============================================================================
// Contrôle de santé
// ============================================================================

export async function getStorageHealth(): Promise<StorageHealthStatus> {
  if (healthCache && Date.now() - healthCache.timestamp < HEALTH_CHECK_TTL_MS) {
    return healthCache.status;
  }

  if (!BLOB_TOKEN) {
    const status: StorageHealthUnavailable = {
      available: false,
      code: 'NOT_CONFIGURED',
      error: 'BLOB_READ_WRITE_TOKEN is not set',
    };
    healthCache = { status, timestamp: Date.now() };
    return status;
  }

  try {
    const testPrefix = toCloudPathname(HEALTH_CHECK_OBJECT);
    await list({ prefix: testPrefix, limit: 1 });
    const status: StorageHealth = { available: true, code: 'AVAILABLE' };
    healthCache = { status, timestamp: Date.now() };
    console.log('[StorageHealth] Vercel Blob storage is AVAILABLE');
    return status;
  } catch (error) {
    const code = getVercelBlobErrorCode(error);
    const healthCode = code as Exclude<StorageHealthCode, 'AVAILABLE'>;
    const status: StorageHealthUnavailable = {
      available: false,
      code: healthCode,
      error: error instanceof Error ? error.message : String(error),
    };
    healthCache = { status, timestamp: Date.now() };
    console.warn(`[StorageHealth] Vercel Blob storage is unavailable: ${healthCode}`);
    return status;
  }
}

export function invalidateStorageHealthCache(): void {
  healthCache = null;
  console.log('[StorageHealth] Health cache invalidated');
}

export async function isStorageAvailable(): Promise<boolean> {
  const health = await getStorageHealth();
  return health.available;
}

// ============================================================================
// Opérations de stockage
// ============================================================================

export async function putPrivateFile(
  key: string,
  data: Buffer | ReadableStream<Uint8Array> | string,
  options: PutOptions = {}
): Promise<StorageResult> {
  const startTime = Date.now();
  const normalizedKey = normalizeAndValidateKey(key);

  const dataSize = typeof data === 'string' 
    ? Buffer.byteLength(data, 'utf8') 
    : Buffer.isBuffer(data) 
      ? data.byteLength 
      : 0;

  if (dataSize > MAX_FILE_SIZE) {
    throw new StorageError('QUOTA_EXCEEDED', `File size ${dataSize} exceeds maximum of ${MAX_FILE_SIZE}`);
  }

  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const health = await getStorageHealth();

  if (health.available && BLOB_TOKEN) {
    try {
      const cloudKey = toCloudPathname(normalizedKey);
      const bufferData = typeof data === 'string' 
        ? Buffer.from(data, 'utf8') 
        : Buffer.isBuffer(data) 
          ? data 
          : Buffer.from(await new Response(data as ReadableStream<Uint8Array>).arrayBuffer());

      const blob = await put(cloudKey, bufferData, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: options.contentType,
      });

      if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
        throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
      }

      console.log('[PrivateStorage] Uploaded to Vercel Blob:', cloudKey, `(${bufferData.byteLength} bytes)`);
      return {
        key: normalizedKey,
        url: blob.url,
        size: bufferData.byteLength,
      };

    } catch (error) {
      const code = getVercelBlobErrorCode(error);
      console.warn(`[PrivateStorage] Vercel Blob upload failed (${code}), falling back to local storage`);
      invalidateStorageHealthCache();

      if (code === 'NOT_CONFIGURED' || code === 'STORE_SUSPENDED' || code === 'AUTHENTICATION_FAILED') {
        return await putPrivateFileLocal(normalizedKey, data, startTime);
      }

      throw new StorageError(
        code,
        `Failed to upload to Vercel Blob: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  return await putPrivateFileLocal(normalizedKey, data, startTime);
}

async function putPrivateFileLocal(
  key: string,
  data: Buffer | ReadableStream<Uint8Array> | string,
  startTime: number
): Promise<StorageResult> {
  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const localPath = toLocalPath(key);
  const bufferData = typeof data === 'string' 
    ? Buffer.from(data, 'utf8') 
    : Buffer.isBuffer(data) 
      ? data 
      : Buffer.from(await new Response(data as ReadableStream<Uint8Array>).arrayBuffer());

  await fs.mkdir(path.dirname(localPath), { recursive: true });
  await fs.writeFile(localPath, bufferData);

  console.log('[PrivateStorage] Uploaded to local storage:', localPath, `(${bufferData.byteLength} bytes)`);
  return {
    key,
    url: null,
    size: bufferData.byteLength,
  };
}

export async function openPrivateFile(key: string): Promise<{
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType?: string;
} | null> {
  const startTime = Date.now();
  const normalizedKey = normalizeAndValidateKey(key);

  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const health = await getStorageHealth();

  if (health.available && BLOB_TOKEN) {
    try {
      const cloudKey = toCloudPathname(normalizedKey);
      const { blobs } = await list({ prefix: cloudKey, limit: 1 });
      const blob = blobs.find((b) => b.pathname === cloudKey) as ListBlobResultBlob | undefined;

      if (!blob) {
        return await openPrivateFileLocal(normalizedKey, startTime);
      }

      const result = await get(cloudKey, { access: 'private', useCache: false });

      if (!result || result.statusCode !== 200 || !result.stream) {
        throw new StorageError('FILE_NOT_FOUND', `Blob not found or inaccessible: ${cloudKey}`);
      }

      // Le contentType est dans result.blob.contentType
      const resultBlob = result as GetBlobResult;
      const blobContentType = (blob as { contentType?: string }).contentType || resultBlob.blob?.contentType || undefined;

      console.log('[PrivateStorage] Stream opened from Vercel Blob:', cloudKey);
      return {
        stream: result.stream,
        size: blob.size,
        contentType: blobContentType,
      };

    } catch (error) {
      const code = getVercelBlobErrorCode(error);
      console.warn(`[PrivateStorage] Vercel Blob open failed (${code}), falling back to local storage`);
      invalidateStorageHealthCache();
      return await openPrivateFileLocal(normalizedKey, startTime);
    }
  }

  return await openPrivateFileLocal(normalizedKey, startTime);
}

async function openPrivateFileLocal(key: string, startTime: number): Promise<{
  stream: ReadableStream<Uint8Array>;
  size: number;
  contentType?: string;
} | null> {
  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const localPath = toLocalPath(key);

  try {
    const stats = await fs.stat(localPath);
    const stream = Readable.toWeb(createReadStream(localPath)) as ReadableStream<Uint8Array>;
    console.log('[PrivateStorage] Stream opened from local storage:', localPath);
    return {
      stream,
      size: stats.size,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function headPrivateFile(key: string): Promise<FileMetadata | null> {
  const startTime = Date.now();
  const normalizedKey = normalizeAndValidateKey(key);

  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const health = await getStorageHealth();

  if (health.available && BLOB_TOKEN) {
    try {
      const cloudKey = toCloudPathname(normalizedKey);
      const { blobs } = await list({ prefix: cloudKey, limit: 1 });
      const blob = blobs.find((b) => b.pathname === cloudKey) as ListBlobResultBlob | undefined;

      if (!blob) {
        return await headPrivateFileLocal(normalizedKey, startTime);
      }

      const blobContentType = (blob as { contentType?: string }).contentType;

      console.log('[PrivateStorage] HEAD from Vercel Blob:', cloudKey);
      return {
        key: normalizedKey,
        size: blob.size,
        contentType: blobContentType || 'application/octet-stream',
        uploadedAt: blob.uploadedAt,
      };

    } catch (error) {
      const code = getVercelBlobErrorCode(error);
      console.warn(`[PrivateStorage] Vercel Blob HEAD failed (${code}), falling back to local storage`);
      invalidateStorageHealthCache();
      return await headPrivateFileLocal(normalizedKey, startTime);
    }
  }

  return await headPrivateFileLocal(normalizedKey, startTime);
}

async function headPrivateFileLocal(key: string, startTime: number): Promise<FileMetadata | null> {
  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const localPath = toLocalPath(key);

  try {
    const stats = await fs.stat(localPath);
    console.log('[PrivateStorage] HEAD from local storage:', localPath);
    return {
      key,
      size: stats.size,
      contentType: 'application/octet-stream',
      uploadedAt: stats.mtime,
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function deletePrivateFile(key: string): Promise<boolean> {
  const startTime = Date.now();
  const normalizedKey = normalizeAndValidateKey(key);

  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const health = await getStorageHealth();

  if (health.available && BLOB_TOKEN) {
    try {
      const cloudKey = toCloudPathname(normalizedKey);
      const { blobs } = await list({ prefix: cloudKey, limit: 1 });
      const blob = blobs.find((b) => b.pathname === cloudKey);

      if (!blob) {
        return await deletePrivateFileLocal(normalizedKey, startTime);
      }

      await del(blob.url);
      console.log('[PrivateStorage] Deleted from Vercel Blob:', cloudKey);
      return true;

    } catch (error) {
      const code = getVercelBlobErrorCode(error);
      console.warn(`[PrivateStorage] Vercel Blob delete failed (${code}), falling back to local storage`);
      invalidateStorageHealthCache();
      return await deletePrivateFileLocal(normalizedKey, startTime);
    }
  }

  return await deletePrivateFileLocal(normalizedKey, startTime);
}

async function deletePrivateFileLocal(key: string, startTime: number): Promise<boolean> {
  if (Date.now() - startTime > OPERATION_TIMEOUT_MS) {
    throw new StorageError('OPERATION_TIMEOUT', 'Storage operation timed out');
  }

  const localPath = toLocalPath(key);

  try {
    await fs.unlink(localPath);
    console.log('[PrivateStorage] Deleted from local storage:', localPath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

export async function listPrivateFiles(prefix: string): Promise<StoredFile[]> {
  const normalizedPrefix = normalizeAndValidateKey(prefix);
  const cloudPrefix = toCloudPathname(normalizedPrefix);

  const health = await getStorageHealth();

  if (health.available && BLOB_TOKEN) {
    try {
      let cursor: string | undefined;
      const items: StoredFile[] = [];

      do {
        const response = await list({
          prefix: cloudPrefix,
          cursor,
          limit: 1000,
        });

        items.push(
          ...response.blobs.map((blob) => {
            const blobWithContentType = blob as { contentType?: string };
            return {
              key: blob.pathname.replace(`${STORAGE_PREFIX}/`, ''),
              url: blob.url,
              size: blob.size,
              contentType: blobWithContentType.contentType || 'application/octet-stream',
              uploadedAt: blob.uploadedAt,
            };
          })
        );

        cursor = response.hasMore ? response.cursor : undefined;
      } while (cursor);

      console.log(`[PrivateStorage] Listed ${items.length} files from Vercel Blob with prefix: ${cloudPrefix}`);
      return items;

    } catch (error) {
      const code = getVercelBlobErrorCode(error);
      console.warn(`[PrivateStorage] Vercel Blob list failed (${code}), falling back to local storage`);
      invalidateStorageHealthCache();
      return await listPrivateFilesLocal(normalizedPrefix);
    }
  }

  return await listPrivateFilesLocal(normalizedPrefix);
}

async function listPrivateFilesLocal(prefix: string): Promise<StoredFile[]> {
  const localDir = toLocalPath(prefix);

  try {
    const entries = await fs.readdir(localDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile());

    const results = await Promise.all(
      files.map(async (entry) => {
        const filePath = path.join(localDir, entry.name);
        const stats = await fs.stat(filePath);

        return {
          key: path.posix.join(prefix, entry.name),
          url: null,
          size: stats.size,
          contentType: 'application/octet-stream',
          uploadedAt: stats.mtime,
        };
      })
    );

    console.log(`[PrivateStorage] Listed ${results.length} files from local storage with prefix: ${prefix}`);
    return results;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

// ============================================================================
// Utilitaires de compatibilité
// ============================================================================

export function toClientFileRef(key: string, publicUrl?: string): string {
  const health = healthCache?.status;
  if (health?.available && publicUrl) {
    return publicUrl;
  }
  return `media/${normalizeAndValidateKey(key)}`;
}

export function storageKeyFromClientRef(value?: string | null): string | null {
  if (!value) return null;
  if (value.startsWith('media/')) {
    return normalizeAndValidateKey(value.slice('media/'.length));
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.hostname.endsWith('.blob.vercel-storage.com')) {
      const pathname = decodeURIComponent(url.pathname).replace(/^\/+/, '');
      const prefix = `${STORAGE_PREFIX}/`;
      return pathname.startsWith(prefix) ? normalizeAndValidateKey(pathname.slice(prefix.length)) : null;
    }
  } catch {
    return null;
  }
  return null;
}
