"use client";

import app, { db } from "./firebase";
import { getStorage } from "firebase/storage";
import { initializeApp, getApps } from "firebase/app";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // ✅ MUST be project-id.appspot.com
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    "family-photo-share-691b5.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getClientDb() {
  return db;
}

export async function getClientAuth() {
  const { getAuth } = await import("firebase/auth");
  return getAuth(app);
}

export async function getStorageClient() {
  try {
    let currentApp =
      getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

    // Debug bucket mismatch
    const configured = (currentApp.options as any).storageBucket;
    if (configured && !configured.endsWith(".appspot.com")) {
      console.warn(
        "[Storage] Misconfigured storageBucket:",
        configured,
        "- expected something like family-photo-share-691b5.appspot.com"
      );
    }

    const storage = getStorage(
      currentApp,
      `gs://${firebaseConfig.storageBucket}`
    );
    return storage;
  } catch (error) {
    console.error("Storage initialization error:", error);
    throw error;
  }
}
