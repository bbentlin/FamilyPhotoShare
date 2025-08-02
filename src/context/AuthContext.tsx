"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        console.log("🔄 Starting auth initialization...");

        // Direct Firebase imports
        const { initializeApp, getApps } = await import("firebase/app");
        const {
          getAuth,
          onAuthStateChanged,
          setPersistence,
          browserSessionPersistence,
        } = await import("firebase/auth");
        const {
          getFirestore,
          doc,
          getDoc,
          setDoc,
          updateDoc,
          serverTimestamp,
        } = await import("firebase/firestore");

        const firebaseConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId:
            process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        };

        const app =
          getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
        const auth = getAuth(app);
        const db = getFirestore(app);

        // Set persistence
        try {
          await setPersistence(auth, browserSessionPersistence);
          console.log("✅ Auth persistence set");
        } catch (persistenceError) {
          console.warn("⚠️ Auth persistence failed:", persistenceError);
        }

        console.log("✅ Firebase initialized, setting up auth listener...");

        // Set up auth listener
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          console.log(
            "🔄 Auth state changed:",
            user ? `User: ${user.email}` : "No user"
          );

          if (user) {
            setUser(user);

            // Create/update user document
            try {
              const userRef = doc(db, "users", user.uid);
              const userDoc = await getDoc(userRef);

              if (!userDoc.exists()) {
                console.log("🔄 Creating user document...");
                await setDoc(userRef, {
                  uid: user.uid,
                  email: user.email,
                  displayName:
                    user.displayName ||
                    user.email?.split("@")[0] ||
                    "Unknown User",
                  photoURL: user.photoURL,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                  lastLoginAt: serverTimestamp(),
                });
                console.log("✅ User document created");
              } else {
                console.log("🔄 Updating user document...");
                await updateDoc(userRef, {
                  displayName:
                    user.displayName ||
                    user.email?.split("@")[0] ||
                    "Unknown User",
                  photoURL: user.photoURL,
                  lastLoginAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
                console.log("✅ User document updated");
              }
            } catch (docError) {
              console.error("❌ User document error:", docError);
            }
          } else {
            setUser(null);
          }

          console.log("✅ Setting loading to false");
          setLoading(false);
        });
      } catch (error) {
        console.error("❌ Auth initialization failed:", error);
        setLoading(false);
      }
    };

    initAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { getAuth, signInWithEmailAndPassword } = await import(
      "firebase/auth"
    );
    const auth = getAuth();
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string, name: string) {
    const { getAuth, createUserWithEmailAndPassword, updateProfile } =
      await import("firebase/auth");
    const auth = getAuth();

    const userCredential = await createUserWithEmailAndPassword(
      auth,
      email,
      password
    );

    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName: name });
    }
  }

  async function signInWithGoogle() {
    const { getAuth, signInWithPopup, GoogleAuthProvider } = await import(
      "firebase/auth"
    );
    const auth = getAuth();
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function logout() {
    const { getAuth, signOut } = await import("firebase/auth");
    const auth = getAuth();
    await signOut(auth);
  }

  async function resetPassword(email: string) {
    const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
    const auth = getAuth();
    await sendPasswordResetEmail(auth, email);
  }

  const value = {
    user,
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    logout,
    resetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
