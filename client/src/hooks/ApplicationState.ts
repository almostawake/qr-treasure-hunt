import { atom, useAtomValue } from 'jotai'
import { type User } from 'firebase/auth'
import { initializeApp } from 'firebase/app'
import { getAuth, connectAuthEmulator } from 'firebase/auth'
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore'

const getFirebaseConfig = async () => {
  if (import.meta.env.DEV) {
    return {
      apiKey: 'demo-not-required',
      authDomain: 'demo-not-required.firebaseapp.com',
      projectId: 'demo-not-required',
    }
  } else {
    const config = await (await fetch('/__/firebase/init.json')).json()
    return config
  }
}

const initializeFirebase = async () => {
  const config = await getFirebaseConfig()
  const app = initializeApp(config)

  const auth = getAuth(app)
  const db = getFirestore(app)

  if (import.meta.env.DEV) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099')
    connectFirestoreEmulator(db, '127.0.0.1', 8080)
  }

  return { app, auth, db }
}

export const firebasePromise = initializeFirebase()
export const getFirebaseServices = async () => {
  const { auth, db } = await firebasePromise
  return { auth, db }
}

export const userAtom = atom<User | null>(null)
export const loadingAtom = atom<boolean>(true)
export const isAuthenticatedAtom = atom((get) => !!get(userAtom))

export const useApplicationState = () => {
  const user = useAtomValue(userAtom)
  const loading = useAtomValue(loadingAtom)
  const isAuthenticated = useAtomValue(isAuthenticatedAtom)

  return {
    user,
    loading,
    isAuthenticated,
  }
}
