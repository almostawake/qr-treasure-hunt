import { useMemo } from 'react'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  QueryDocumentSnapshot,
  DocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { getFirebaseServices } from './ApplicationState'
import type { Hunt, Clue, FirestoreHunt } from '../types'

const convertFirestoreHunt = (
  doc: QueryDocumentSnapshot<DocumentData>
): Hunt => {
  const data = doc.data() as FirestoreHunt
  return {
    id: doc.id,
    displayName: data.displayName || '',
    clues: data.clues || [],
  }
}

const convertDocumentSnapshotToHunt = (
  doc: DocumentSnapshot<DocumentData>
): Hunt | null => {
  if (!doc.exists()) return null
  const data = doc.data() as FirestoreHunt
  return {
    id: doc.id,
    displayName: data.displayName || '',
    clues: data.clues || [],
  }
}

export class HuntService {
  constructor() {
    // No parameters needed currently
  }

  // Create a new hunt
  async createHunt(displayName: string): Promise<string> {
    const { db } = await getFirebaseServices()

    const huntData: FirestoreHunt = {
      displayName,
      clues: [],
    }

    const docRef = await addDoc(collection(db, 'hunts'), huntData)

    // Add to known hunts in local storage
    const { LocalHuntStorage } = await import('./LocalHuntStorage')
    LocalHuntStorage.addKnownHuntId(docRef.id)

    return docRef.id
  }

  // Update hunt display name
  async updateHuntName(huntId: string, displayName: string): Promise<void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    await updateDoc(huntRef, {
      displayName,
    })
  }

  // Delete a hunt
  async deleteHunt(huntId: string): Promise<void> {
    const { db, storage } = await getFirebaseServices()

    // Get hunt to find all media files
    const huntRef = doc(db, 'hunts', huntId)
    const huntDoc = await getDoc(huntRef)

    if (huntDoc.exists()) {
      const hunt = convertDocumentSnapshotToHunt(huntDoc)
      if (hunt) {
        // Delete all media files from storage
        const mediaUrls = hunt.clues
          .filter((clue) => clue.mediaUrl && !clue.mediaUrl.startsWith('http'))
          .map((clue) => clue.mediaUrl!)

        // Delete files in parallel
        await Promise.all(
          mediaUrls.map(async (mediaUrl) => {
            try {
              const { ref, deleteObject } = await import('firebase/storage')
              const storageRef = ref(storage, mediaUrl)
              await deleteObject(storageRef)
            } catch {
              // Continue even if file deletion fails
            }
          })
        )
      }
    }

    // Delete the hunt document
    await deleteDoc(huntRef)
  }

  // Create a new clue in a hunt
  async createClue(
    huntId: string,
    text: string = '',
    hint: string = ''
  ): Promise<string> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    // Get current hunt
    const huntDoc = await getDoc(huntRef)
    if (!huntDoc.exists()) throw new Error('Hunt not found')

    const hunt = convertDocumentSnapshotToHunt(huntDoc)
    if (!hunt) throw new Error('Hunt not found')

    // Generate new clue ID
    const clueId = crypto.randomUUID()

    // Create new clue
    const newClue: Clue = {
      id: clueId,
      text,
      hint,
      order: hunt.clues.length,
    }

    // Add to clues array
    const updatedClues = [...hunt.clues, newClue]

    await updateDoc(huntRef, {
      clues: updatedClues,
    })

    return clueId
  }

  // Update a clue
  async updateClue(
    huntId: string,
    clueId: string,
    updates: Partial<Pick<Clue, 'text' | 'hint' | 'mediaUrl' | 'mediaType'>>
  ): Promise<void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    // Get current hunt
    const huntDoc = await getDoc(huntRef)
    if (!huntDoc.exists()) throw new Error('Hunt not found')

    const hunt = convertDocumentSnapshotToHunt(huntDoc)
    if (!hunt) throw new Error('Hunt not found')

    // Find and update the clue
    const updatedClues = hunt.clues.map((clue) =>
      clue.id === clueId ? { ...clue, ...updates } : clue
    )

    await updateDoc(huntRef, {
      clues: updatedClues,
    })
  }

  // Delete media from a clue
  async deleteClueMedia(huntId: string, clueId: string): Promise<void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    // Get current hunt
    const huntDoc = await getDoc(huntRef)
    if (!huntDoc.exists()) throw new Error('Hunt not found')

    const hunt = convertDocumentSnapshotToHunt(huntDoc)
    if (!hunt) throw new Error('Hunt not found')

    // Find and update the clue to remove media
    const updatedClues = hunt.clues.map((clue) => {
      if (clue.id === clueId) {
        const { mediaUrl, mediaType, ...rest } = clue
        return rest
      }
      return clue
    })

    await updateDoc(huntRef, {
      clues: updatedClues,
    })
  }

  // Delete a clue
  async deleteClue(huntId: string, clueId: string): Promise<void> {
    const { db, storage } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    // Get current hunt
    const huntDoc = await getDoc(huntRef)
    if (!huntDoc.exists()) throw new Error('Hunt not found')

    const hunt = convertDocumentSnapshotToHunt(huntDoc)
    if (!hunt) throw new Error('Hunt not found')

    // Find the clue to check for media
    const clueToDelete = hunt.clues.find((clue) => clue.id === clueId)

    // Delete media file from storage if it exists
    if (clueToDelete?.mediaUrl && !clueToDelete.mediaUrl.startsWith('http')) {
      try {
        const { ref, deleteObject } = await import('firebase/storage')
        const storageRef = ref(storage, clueToDelete.mediaUrl)
        await deleteObject(storageRef)
      } catch {
        // Continue even if file deletion fails
      }
    }

    // Remove the clue
    const updatedClues = hunt.clues.filter((clue) => clue.id !== clueId)

    await updateDoc(huntRef, {
      clues: updatedClues,
    })
  }

  // Update clue order (for drag and drop)
  async updateClueOrder(huntId: string, clues: Clue[]): Promise<void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    // Update order field to match array index
    const orderedClues = clues.map((clue, index) => ({
      ...clue,
      order: index,
    }))

    await updateDoc(huntRef, {
      clues: orderedClues,
    })
  }

  // Subscribe to a single hunt document with real-time updates
  async subscribeToHunt(
    huntId: string,
    callback: (hunt: Hunt | null) => void
  ): Promise<() => void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    const unsubscribe = onSnapshot(huntRef, (snapshot) => {
      const hunt = convertDocumentSnapshotToHunt(snapshot)
      callback(hunt)
    })

    return unsubscribe
  }

  // Subscribe to all hunts (not recommended for production, but useful for admin)
  async subscribeToAllHunts(
    callback: (hunts: Hunt[]) => void
  ): Promise<() => void> {
    const { db } = await getFirebaseServices()

    const unsubscribe = onSnapshot(collection(db, 'hunts'), (snapshot) => {
      const hunts = snapshot.docs.map(convertFirestoreHunt)
      callback(hunts)
    })

    return unsubscribe
  }

  // Subscribe to known hunts only (filtered by local storage)
  async subscribeToKnownHunts(
    callback: (hunts: Hunt[]) => void
  ): Promise<() => void> {
    const { LocalHuntStorage } = await import('./LocalHuntStorage')

    const { db } = await getFirebaseServices()

    const unsubscribe = onSnapshot(collection(db, 'hunts'), (snapshot) => {
      const allHunts = snapshot.docs.map(convertFirestoreHunt)
      const knownHuntIds = LocalHuntStorage.getKnownHuntIds()

      // Filter to only known hunts
      const knownHunts = allHunts.filter((hunt) =>
        knownHuntIds.includes(hunt.id)
      )

      // Clean up any known IDs that no longer exist in Firebase
      const existingHuntIds = allHunts.map((hunt) => hunt.id)
      const invalidKnownIds = knownHuntIds.filter(
        (id) => !existingHuntIds.includes(id)
      )

      invalidKnownIds.forEach((invalidId) => {
        LocalHuntStorage.removeKnownHuntId(invalidId)
      })

      callback(knownHunts)
    })

    return unsubscribe
  }

  // Get a single hunt (one-time read, uses cache)
  async getHunt(huntId: string): Promise<Hunt | null> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)
    const huntDoc = await getDoc(huntRef)

    return convertDocumentSnapshotToHunt(huntDoc)
  }
}

export const useHuntService = () => {
  return useMemo(() => new HuntService(), [])
}
