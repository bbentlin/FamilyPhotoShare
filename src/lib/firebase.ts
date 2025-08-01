import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Debug logging (remove in production)
console.log('Firebase Config:', {
  apiKey: firebaseConfig.apiKey ? '[SET]' : '[MISSING]',
  authDomain: firebaseConfig.authDomain ? '[SET]' : '[MISSING]',
  projectId: firebaseConfig.projectId ? '[SET]' : '[MISSING]',
  storageBucket: firebaseConfig.storageBucket ? '[SET]' : '[MISSING]',
  messagingSenderId: firebaseConfig.messagingSenderId ? '[SET]' : '[MISSING]',
  appId: firebaseConfig.appId ? '[SET]' : '[MISSING]',
});

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export default app;