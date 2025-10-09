import { atom, useAtomValue } from 'jotai'
import { initializeApp } from 'firebase/app'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'
import { getStorage, connectStorageEmulator } from 'firebase/storage'

const getFirebaseConfig = async () => {
  if (import.meta.env.DEV) {
    return {
      apiKey: 'demo-not-required',
      authDomain: 'demo-not-required.firebaseapp.com',
      projectId: 'demo-not-required',
      storageBucket: 'demo-not-required.appspot.com',
    }
  } else {
    const config = await (await fetch('/__/firebase/init.json')).json()
    return config
  }
}

const initializeFirebase = async () => {
  const config = await getFirebaseConfig()
  const app = initializeApp(config)

  const db = getFirestore(app)
  const storage = getStorage(app)

  if (import.meta.env.DEV) {
    try {
      // Use localhost for local development, but allow network access via emulator host config
      connectFirestoreEmulator(db, '127.0.0.1', 8080)
    } catch (error) {
      // Already connected
    }

    try {
      connectStorageEmulator(storage, '127.0.0.1', 9199)
    } catch (error) {
      // Already connected
    }
  }

  return { app, db, storage }
}

export const firebasePromise = initializeFirebase()
export const getFirebaseServices = async () => {
  const { db, storage } = await firebasePromise
  return { db, storage }
}

export const loadingAtom = atom<boolean>(false)
export const isOnlineAtom = atom<boolean>(true)

export const useApplicationState = () => {
  const loading = useAtomValue(loadingAtom)
  const isOnline = useAtomValue(isOnlineAtom)

  return {
    loading,
    isOnline,
  }
}
