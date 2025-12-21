import { openDB } from 'idb'
import type { IDBPDatabase } from 'idb'
import { getBlob, ref } from 'firebase/storage'
import type { FirebaseStorage } from 'firebase/storage'

interface CacheEntry {
  blob: Blob
  timestamp: number
}

export class FirebaseStorageCache {
  private dbPromise: Promise<IDBPDatabase>
  private objectUrlCache: Map<string, string> = new Map()
  private storage: FirebaseStorage

  constructor(storage: FirebaseStorage) {
    this.storage = storage
    this.dbPromise = openDB('firebase-storage-cache', 1, {
      upgrade(db) {
        db.createObjectStore('files')
      },
    })
  }

  async getFile(path: string): Promise<Blob> {
    const db = await this.dbPromise
    const cached = await db.get('files', path)

    if (cached) {
      const entry = cached as CacheEntry
      return entry.blob
    }

    const blob = await getBlob(ref(this.storage, path))
    const entry: CacheEntry = {
      blob,
      timestamp: Date.now(),
    }
    await db.put('files', entry, path)
    return blob
  }

  async getFileUrl(path: string): Promise<string> {
    // Check if we already have an object URL for this path
    const existingUrl = this.objectUrlCache.get(path)
    if (existingUrl) {
      return existingUrl
    }

    const blob = await this.getFile(path)
    const url = URL.createObjectURL(blob)
    this.objectUrlCache.set(path, url)
    return url
  }

  // Revoke object URL and remove from cache (call on component unmount)
  revokeFileUrl(path: string): void {
    const url = this.objectUrlCache.get(path)
    if (url) {
      URL.revokeObjectURL(url)
      this.objectUrlCache.delete(path)
    }
  }

  // Prefetch files in the background (batches of 3)
  prefetch(paths: string[]): void {
    this.dbPromise.then(async (db) => {
      const uncached = (
        await Promise.all(
          paths.map(async (p) => ((await db.getKey('files', p)) ? null : p))
        )
      ).filter(Boolean) as string[]

      // Fetch in batches of 3 to avoid overwhelming the network
      for (let i = 0; i < uncached.length; i += 3) {
        await Promise.all(
          uncached.slice(i, i + 3).map((p) => this.getFile(p).catch(() => {}))
        )
      }
    })
  }

  // Invalidate cache for a specific path (call when uploading a new file)
  async invalidate(path: string): Promise<void> {
    const db = await this.dbPromise
    await db.delete('files', path)

    // Also revoke object URL if it exists
    this.revokeFileUrl(path)
  }

  // Clear entire cache
  async clear(): Promise<void> {
    const db = await this.dbPromise
    await db.clear('files')

    // Revoke all object URLs
    this.objectUrlCache.forEach((url) => URL.revokeObjectURL(url))
    this.objectUrlCache.clear()
  }
}
