import { useMemo } from 'react'
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  where,
  Timestamp,
  getDocs,
  getDoc,
} from 'firebase/firestore'
import { getFirebaseServices } from './ApplicationState'
import type { Hunt, Clue, FirestoreHunt, FirestoreClue } from '../types'

// Convert Firestore timestamp to Date
const convertFirestoreHunt = (
  doc: { id: string; data: () => FirestoreHunt }
): Hunt => ({
  id: doc.id,
  displayName: doc.data().displayName,
  createdAt: doc.data().createdAt.toDate(),
  updatedAt: doc.data().updatedAt.toDate(),
  clueOrder: doc.data().clueOrder || [],
})

const convertFirestoreClue = (
  doc: { id: string; data: () => FirestoreClue }
): Clue => ({
  id: doc.id,
  huntId: doc.data().huntId,
  text: doc.data().text,
  hint: doc.data().hint,
  mediaUrl: doc.data().mediaUrl,
  mediaType: doc.data().mediaType,
  order: doc.data().order,
})

export class HuntService {
  constructor() {
    // No parameters needed currently
  }

  // Create a new hunt
  async createHunt(displayName: string): Promise<string> {
    const { db } = await getFirebaseServices()
    const now = Timestamp.now()

    const huntData: Omit<FirestoreHunt, 'id'> = {
      displayName,
      createdAt: now,
      updatedAt: now,
      clueOrder: [],
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
      updatedAt: Timestamp.now(),
    })
  }

  // Update clue order after drag and drop
  async updateClueOrder(huntId: string, clueOrder: string[]): Promise<void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    await updateDoc(huntRef, {
      clueOrder,
      updatedAt: Timestamp.now(),
    })
  }

  // Delete a hunt and all its clues
  async deleteHunt(huntId: string): Promise<void> {
    const { db } = await getFirebaseServices()

    // Delete all clues first
    const cluesQuery = query(
      collection(db, 'clues'),
      where('huntId', '==', huntId)
    )
    const cluesSnapshot = await getDocs(cluesQuery)

    const deletePromises = cluesSnapshot.docs.map((doc) => deleteDoc(doc.ref))
    await Promise.all(deletePromises)

    // Then delete the hunt
    await deleteDoc(doc(db, 'hunts', huntId))
  }

  // Create a new clue
  async createClue(
    huntId: string,
    text: string = '',
    hint: string = ''
  ): Promise<string> {
    const { db } = await getFirebaseServices()

    // Get current clue count to set order
    const cluesQuery = query(
      collection(db, 'clues'),
      where('huntId', '==', huntId)
    )
    const cluesSnapshot = await getDocs(cluesQuery)
    const order = cluesSnapshot.size

    const clueData: Omit<FirestoreClue, 'id'> = {
      huntId,
      text,
      hint,
      order,
    }

    const docRef = await addDoc(collection(db, 'clues'), clueData)

    // Add to hunt's clueOrder
    const huntRef = doc(db, 'hunts', huntId)
    const huntDoc = await getDoc(huntRef)
    const currentOrder = huntDoc.data()?.clueOrder || []

    await updateDoc(huntRef, {
      clueOrder: [...currentOrder, docRef.id],
      updatedAt: Timestamp.now(),
    })

    return docRef.id
  }

  // Update clue text or hint
  async updateClue(
    clueId: string,
    updates: Partial<Pick<Clue, 'text' | 'hint' | 'mediaUrl' | 'mediaType'>>
  ): Promise<void> {
    const { db } = await getFirebaseServices()
    const clueRef = doc(db, 'clues', clueId)

    await updateDoc(clueRef, updates)
  }

  // Delete a clue
  async deleteClue(huntId: string, clueId: string): Promise<void> {
    const { db } = await getFirebaseServices()

    // Remove from hunt's clueOrder
    const huntRef = doc(db, 'hunts', huntId)
    const huntDoc = await getDoc(huntRef)
    const currentOrder = huntDoc.data()?.clueOrder || []
    const newOrder = currentOrder.filter((id: string) => id !== clueId)

    await updateDoc(huntRef, {
      clueOrder: newOrder,
      updatedAt: Timestamp.now(),
    })

    // Delete the clue
    await deleteDoc(doc(db, 'clues', clueId))
  }

  // Subscribe to all hunts
  async subscribeToHunts(
    callback: (hunts: Hunt[]) => void
  ): Promise<() => void> {
    const { db } = await getFirebaseServices()
    const q = query(collection(db, 'hunts'), orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const hunts = snapshot.docs.map(convertFirestoreHunt)
      callback(hunts)
    })

    return unsubscribe
  }

  // Subscribe to a single hunt document
  async subscribeToHunt(
    huntId: string,
    callback: (hunt: Hunt | null) => void
  ): Promise<() => void> {
    const { db } = await getFirebaseServices()
    const huntRef = doc(db, 'hunts', huntId)

    const unsubscribe = onSnapshot(huntRef, (snapshot) => {
      if (snapshot.exists()) {
        const hunt = convertFirestoreHunt({
          id: snapshot.id,
          data: () => snapshot.data() as FirestoreHunt,
        })
        callback(hunt)
      } else {
        // Hunt doesn't exist (was deleted)
        callback(null)
      }
    })

    return unsubscribe
  }

  // Subscribe to known hunts only (filtered by local storage)
  async subscribeToKnownHunts(
    callback: (hunts: Hunt[]) => void
  ): Promise<() => void> {
    const { LocalHuntStorage } = await import('./LocalHuntStorage')

    const { db } = await getFirebaseServices()
    const q = query(collection(db, 'hunts'), orderBy('updatedAt', 'desc'))

    const unsubscribe = onSnapshot(q, (snapshot) => {
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

  // Subscribe to clues for a specific hunt
  async subscribeToClues(
    huntId: string,
    callback: (clues: Clue[]) => void
  ): Promise<() => void> {
    const { db } = await getFirebaseServices()
    const q = query(
      collection(db, 'clues'),
      where('huntId', '==', huntId),
      orderBy('order', 'asc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const clues = snapshot.docs.map(convertFirestoreClue)
      callback(clues)
    })

    return unsubscribe
  }
}

export const useHuntService = () => {
  return useMemo(() => new HuntService(), [])
}
