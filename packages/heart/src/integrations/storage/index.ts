import 'server-only';
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Object storage interface (R2 in the integrations phase, TL-INT-R2). The
// mock keeps bytes in this process only — enough for tests and local
// demos; uploads are labelled "Demo upload — not stored" in the UI.

export interface ObjectStore {
  slug: string;
  put(key: string, bytes: Uint8Array, contentType: string): Promise<{ key: string; size: number }>;
  get(key: string): Promise<{ bytes: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-z0-9][a-z0-9/_.-]{0,250}$/;

export function createMemoryStore(maxBytes = 10 * 1024 * 1024): ObjectStore {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    slug: 'mock_storage',
    async put(key, bytes, contentType) {
      if (!SAFE_KEY.test(key) || key.includes('..')) throw new RangeError(`Unsafe object key: ${key}`);
      if (bytes.byteLength > maxBytes) throw new RangeError(`Object larger than ${maxBytes} bytes`);
      objects.set(key, { bytes: bytes.slice(), contentType });
      return { key, size: bytes.byteLength };
    },
    async get(key) {
      return objects.get(key) ?? null;
    },
    async delete(key) {
      objects.delete(key);
    },
  };
}

export function createLocalDiskStore(directory: string, maxBytes = 10 * 1024 * 1024): ObjectStore {
  const objectPath = (key: string) => {
    if (!SAFE_KEY.test(key) || key.includes('..') || key.includes('/')) throw new RangeError(`Unsafe object key: ${key}`);
    return join(directory, key);
  };
  return {
    slug: 'local_disk',
    async put(key, bytes, contentType) {
      if (bytes.byteLength > maxBytes) throw new RangeError(`Object larger than ${maxBytes} bytes`);
      await mkdir(directory, { recursive: true });
      await writeFile(objectPath(key), bytes);
      return { key, size: bytes.byteLength };
    },
    async get(key) {
      try {
        const bytes = await readFile(objectPath(key));
        return { bytes: new Uint8Array(bytes), contentType: 'application/octet-stream' };
      } catch (error) {
        if ((error as { code?: string }).code === 'ENOENT') return null;
        throw error;
      }
    },
    async delete(key) {
      await unlink(objectPath(key)).catch((error) => {
        if ((error as { code?: string }).code !== 'ENOENT') throw error;
      });
    },
  };
}

