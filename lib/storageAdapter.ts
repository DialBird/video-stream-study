// Storage adapter that switches between Manus storage and local S3
// based on USE_LOCAL_STORAGE environment variable

import { storagePut as manusStoragePut, storageGet as manusStorageGet } from "./storage";
import { localStoragePut, localStorageGet, localStorageDelete } from "./localStorage";

const useLocalStorage = process.env.USE_LOCAL_STORAGE === "true";

/**
 * Upload file to storage (Manus or local S3)
 */
export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = "application/octet-stream"
): Promise<{ key: string; url: string }> {
  if (useLocalStorage) {
    return localStoragePut(relKey, data, contentType);
  }
  return manusStoragePut(relKey, data, contentType);
}

/**
 * Get download URL for file (Manus or local S3)
 */
export async function storageGet(
  relKey: string,
  expiresIn = 3600
): Promise<{ key: string; url: string }> {
  if (useLocalStorage) {
    return localStorageGet(relKey, expiresIn);
  }
  return manusStorageGet(relKey);
}

/**
 * Delete file from storage
 * Note: Manus storage doesn't have a delete API yet, so this only works with local S3
 */
export async function storageDelete(relKey: string): Promise<void> {
  if (useLocalStorage) {
    return localStorageDelete(relKey);
  }
  // Manus storage doesn't support delete yet
  console.warn("Storage delete is not supported for Manus storage");
}
