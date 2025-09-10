"use client";

import app, { db } from "./firebase";
import { getStorage } from "firebase/storage";
import { initializeApp, getApps } from "firebase/app";

// Make sure your Firebase config includes the correct storageBucket
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, // This should now be family-photo-share-691b5.firebasestorage.app
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
    let app;
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }

    // Initialize storage with the correct bucket
    const storage = getStorage(app);
    console.log(
      "Storage initialized with bucket:",
      firebaseConfig.storageBucket
    );
    return storage;
  } catch (error) {
    console.error("Storage initialization error:", error);
    throw error;
  }
}
