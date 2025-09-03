import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from "firebase/firestore";

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

// Firestore: use XHR long-polling on the client to avoid CORS/proxy issues
let _db: Firestore | null = null;
export function getDb(): Firestore {
  if (_db) return _db;
  const app = getFirebaseApp();
  if (typeof window !== "undefined") {
    _db = initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    });
  } else {
    _db = getFirestore(app);
  }
  return _db;
}
export const db: Firestore = getDb();

// Client-only, async Storage getter
export async function getStorageClient() {
  if (typeof window === "undefined") {
    throw new Error("Firebase Storage is not available on the server");
  }
  const { getStorage } = await import("firebase/storage");
  return getStorage(getFirebaseApp());
}
