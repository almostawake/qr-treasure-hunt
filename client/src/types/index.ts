export interface Clue {
  id: string // Generated UUID for client-side identification
  text: string
  hint: string
  mediaUrl?: string // Firebase Storage URL for photo/video
  mediaType?: 'image' | 'video'
  order: number // Backup ordering system
}

export interface Hunt {
  id: string // Firestore document ID
  displayName: string
  clues: Clue[] // Clues embedded in the hunt document
}

export interface FirestoreHunt {
  displayName: string
  clues: Clue[] // Same structure in Firestore
}
