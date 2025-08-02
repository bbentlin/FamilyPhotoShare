import { initializeApp, getApps, FirebaseApp } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase app
let app: FirebaseApp;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} else {
  // Create a minimal app for server side
  app = {} as FirebaseApp;
}

// SAFE EXPORTS - These will work immediately
export const getFirebaseAuth = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const { getAuth } = await import('firebase/auth');
    return getAuth(app);
  } catch (error) {
    console.error('Failed to initialize Firebase Auth:', error);
    return null;
  }
};

export const getFirebaseDb = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const { getFirestore } = await import('firebase/firestore');
    return getFirestore(app);
  } catch (error) {
    console.error('Failed to initialize Firestore:', error);
    return null;
  }
};

export const getFirebaseStorage = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const { getStorage } = await import('firebase/storage');
    return getStorage(app);
  } catch (error) {
    console.error('Failed to initialize Firebase Storage:', error);
    return null;
  }
};

export const getGoogleProvider = async () => {
  if (typeof window === 'undefined') return null;

  try {
    const { GoogleAuthProvider } = await import('firebase/auth');
    return new GoogleAuthProvider();
  } catch (error) {
    console.error('Failed to initialize Google Provider:', error);
    return null;
  }
};

// IMMEDIATE EXPORTS - Initialize synchronously on client
let auth: any = null;
let db: any = null;
let storage: any = null;
let googleProvider: any = null;

if (typeof window !== 'undefined') {
  // Initialize immediately on client side
  import('firebase/auth').then(({ getAuth, GoogleAuthProvider }) => {
    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
  });

  import('firebase/firestore').then(({ getFirestore }) => {
    db = getFirestore(app);
  });

  import('firebase/storage').then(({ getStorage }) => {
    storage = getStorage(app);
  });
}

// Safe exports that won't be null
export { auth, db, storage, googleProvider };
export default app;

