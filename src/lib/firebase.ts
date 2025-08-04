import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app safely
let app: FirebaseApp;

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} catch (error) {
  console.error('Firebase initialization error:', error);
  // Create a dummy app to prevent crashes
  app = {} as FirebaseApp;
}

// Safe service getters - NEVER return null immediately
export const getAuth = () => {
  if (typeof window === 'undefined') return null;
  try {
    const { getAuth } = require('firebase/auth');
    return getAuth(app);
  } catch (error) {
    console.error('Auth initialization error:', error);
    return null;
  }
};

export const getDb = () => {
  if (typeof window === 'undefined') return null;
  try {
    const { getFirestore } = require('firebase/firestore');
    return getFirestore(app);
  } catch (error) {
    console.error('Firestore initialization error:', error);
    return null;
  }
};

export const getStorage = () => {
  if (typeof window === 'undefined') return null;
  try {
    const { getStorage } = require('firebase/storage');
    return getStorage(app);
  } catch (error) {
    console.error('Storage initialization error:', error);
    return null;
  }
};

// Legacy exports for backward compatibility
export const auth = typeof window !== 'undefined' ? getAuth() : null;
export const db = typeof window !== 'undefined' ? getDb() : null;
export const storage = typeof window !== 'undefined' ? getStorage() : null;

export default app;

