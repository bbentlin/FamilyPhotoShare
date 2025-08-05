import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage as getFirebaseStorage, FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey:             process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain:         process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId:          process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket:      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId:  process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId:              process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

export let storage: FirebaseStorage | null;
try {
  storage = getFirebaseStorage(app);
} catch (e) {
  console.warn("⚠️ Firebase Storage initialization failed:", e);
  storage = null;
}

/**
 * Back-compat helper for code doing `import { getDb } from '@/lib/firebase'`
 */
export function getDb(): Firestore {
  return db;
}

/**
 * Back-compat helper for code doing `import { getStorage } from '@/lib/firebase'`
 */
export function getStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error("Firebase storage is not available");
  }
  return storage;
}

