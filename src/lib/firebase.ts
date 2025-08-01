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
  // Only initialize on client side
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
} else {
  // Create a mock app for server side
  app = {} as FirebaseApp;
}

// Lazy initialization functions to avoid immediate service loading
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

// Legacy exports for backward compatibility (will be null on server)
export let auth: any = null;
export let db: any = null;
export let storage: any = null;
export let googleProvider: any = null;

// Initialize services on client side only
if (typeof window !== 'undefined') {
  // Use dynamic imports to prevent server-side loading
  Promise.all([
    getFirebaseAuth(),
    getFirebaseDb(),
    getFirebaseStorage(),
    getGoogleProvider(),
  ])
    .then(([authService, dbService, storageService, providerService]) => {
      auth = authService;
      db = dbService;
      storage = storageService;
      googleProvider = providerService;
    })
    .catch((error) => {
      console.error('Failed to initialize Firebase services:', error);
    });
}

export default app;

