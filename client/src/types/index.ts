export interface Hunt {
  id: string
  displayName: string
  createdAt: Date
  updatedAt: Date
  clueOrder: string[] // Array of clue IDs for drag-and-drop ordering
}

export interface Clue {
  id: string
  huntId: string
  text: string
  hint: string
  mediaUrl?: string // Firebase Storage URL for photo/video
  mediaType?: 'image' | 'video'
  order: number // Backup ordering system
}

// Firestore timestamp type for better type safety
export interface FirestoreHunt {
  id: string
  displayName: string
  createdAt: any // Firestore Timestamp
  updatedAt: any // Firestore Timestamp
  clueOrder: string[]
}

export interface FirestoreClue {
  id: string
  huntId: string
  text: string
  hint: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  order: number
}
