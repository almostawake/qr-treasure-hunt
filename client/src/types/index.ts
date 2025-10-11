export interface Hunt {
  id: string
  displayName: string
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

export interface FirestoreHunt {
  id: string
  displayName: string
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
