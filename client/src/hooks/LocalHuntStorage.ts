// Local storage service for tracking known hunt IDs
const STORAGE_KEY = 'qr-treasure-hunt-known-hunts'

export class LocalHuntStorage {
  // Get all known hunt IDs from local storage
  static getKnownHuntIds(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  }

  // Add a hunt ID to known hunts (if not already present)
  static addKnownHuntId(huntId: string): void {
    try {
      const knownIds = this.getKnownHuntIds()
      if (!knownIds.includes(huntId)) {
        const updatedIds = [...knownIds, huntId]
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds))
      }
    } catch {
      // Silently fail - not critical
    }
  }

  // Remove a hunt ID from known hunts (cleanup for deleted/invalid hunts)
  static removeKnownHuntId(huntId: string): void {
    try {
      const knownIds = this.getKnownHuntIds()
      const updatedIds = knownIds.filter((id) => id !== huntId)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedIds))
    } catch {
      // Silently fail - not critical
    }
  }

  // Check if a hunt ID is known to this browser
  static isHuntKnown(huntId: string): boolean {
    return this.getKnownHuntIds().includes(huntId)
  }

  // Clear all known hunts (for debugging/reset)
  static clearKnownHunts(): void {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Silently fail - not critical
    }
  }
}
