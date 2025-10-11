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
      const devHost = window.location.hostname
      connectFirestoreEmulator(db, devHost, 8080)
    } catch {
      // Already connected
    }

    try {
      const devHost = window.location.hostname
      connectStorageEmulator(storage, devHost, 9199)
    } catch {
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
