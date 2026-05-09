import { getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { type Auth, getAuth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

interface FirebaseEnv {
  apiKey: string
  authDomain: string
  projectId: string
  appId: string
  storageBucket?: string
  messagingSenderId?: string
}

function readEnv(): FirebaseEnv | null {
  const env = import.meta.env
  const apiKey = env.VITE_FIREBASE_API_KEY
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  const appId = env.VITE_FIREBASE_APP_ID
  if (!apiKey || !authDomain || !projectId || !appId) return null
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  }
}

let cachedApp: FirebaseApp | null = null
let cachedDb: Firestore | null = null
let cachedAuth: Auth | null = null
let initAttempted = false

function ensureApp(): FirebaseApp | null {
  if (initAttempted) return cachedApp
  initAttempted = true
  const env = readEnv()
  if (!env) return null
  try {
    cachedApp = getApps()[0] ?? initializeApp(env)
    return cachedApp
  } catch (err) {
    console.warn('[firebase] failed to initialize:', err)
    return null
  }
}

export function getDb(): Firestore | null {
  if (cachedDb) return cachedDb
  const app = ensureApp()
  if (!app) return null
  try {
    cachedDb = getFirestore(app)
    return cachedDb
  } catch (err) {
    console.warn('[firebase] failed to get firestore:', err)
    return null
  }
}

export function getAuthClient(): Auth | null {
  if (cachedAuth) return cachedAuth
  const app = ensureApp()
  if (!app) return null
  try {
    cachedAuth = getAuth(app)
    return cachedAuth
  } catch (err) {
    console.warn('[firebase] failed to get auth:', err)
    return null
  }
}

export function isFirebaseConfigured(): boolean {
  return readEnv() != null
}
