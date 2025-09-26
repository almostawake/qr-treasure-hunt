import { useMemo } from 'react'
import { useSetAtom } from 'jotai'
import {
  type User,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
} from 'firebase/auth'
import { userAtom, loadingAtom, getFirebaseServices } from './ApplicationState'

export class UserService {
  private setUser: (user: User | null) => void
  private setLoading: (loading: boolean) => void

  constructor(
    setUser: (user: User | null) => void,
    setLoading: (loading: boolean) => void
  ) {
    this.setUser = setUser
    this.setLoading = setLoading
  }

  async login(): Promise<void> {
    const { auth } = await getFirebaseServices()
    const googleProvider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Login error:', error)
      throw error
    }
  }

  async logout(): Promise<void> {
    const { auth } = await getFirebaseServices()
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Logout error:', error)
      throw error
    }
  }

  async initialize(): Promise<() => void> {
    const { auth } = await getFirebaseServices()
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      this.setUser(user)
      this.setLoading(false)
    })
    return unsubscribe
  }
}

export const useUserService = () => {
  const setUser = useSetAtom(userAtom)
  const setLoading = useSetAtom(loadingAtom)

  return useMemo(
    () => new UserService(setUser, setLoading),
    [setUser, setLoading]
  )
}