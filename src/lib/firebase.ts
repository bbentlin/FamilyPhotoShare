import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const auth: Auth = getAuth(getFirebaseApp());

// Export a singleton Firestore instance so imports like { db } work
export const db: Firestore = getFirestore(getFirebaseApp());

// Back-compat for callers using getDb()
export function getDb(): Firestore {
  return db;
}

// Client-only, async storage getter (loads the SDK chunk before use)
export async function getStorageClient() {
  if (typeof window === "undefined") {
    throw new Error("Firebase Storage is not available on the server");
  }
  const { getStorage } = await import("firebase/storage");
  return getStorage(getFirebaseApp());
}
