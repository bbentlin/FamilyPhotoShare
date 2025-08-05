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

    console.log("🔄 Starting auth initialization...");

    let unsubscribe: (() => void) | undefined;

    const initAuth = async () => {
      try {
        // Wait for window to be ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log("🔄 Initializing Firebase directly...");

        // Direct Firebase initialization
        const { initializeApp, getApps } = await import("firebase/app");
        const {
          getAuth,
          onAuthStateChanged,
          setPersistence,
          browserSessionPersistence,
        } = await import("firebase/auth");

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

        console.log("✅ Firebase initialized, Auth available:", !!auth);

        // Set persistence
        try {
          await setPersistence(auth, browserSessionPersistence);
          console.log("✅ Auth persistence set");
        } catch (persistenceError) {
          console.warn("⚠️ Auth persistence failed:", persistenceError);
        }

        // Set up auth listener
        unsubscribe = onAuthStateChanged(auth, async (user) => {
          console.log(
            "🔄 Auth state changed:",
            user ? `User: ${user.email}` : "No user"
          );
          setUser(user);
          setLoading(false);

          if (user) {
            // Optional: Create user document in the background
            try {
              const { getFirestore, doc, getDoc, setDoc, serverTimestamp } =
                await import("firebase/firestore");
              const db = getFirestore(app);

              const userRef = doc(db, "users", user.uid);
              const userDoc = await getDoc(userRef);

              if (!userDoc.exists()) {
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
              }
            } catch (docError) {
              console.warn("⚠️ User document creation failed:", docError);
            }
          }
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
    console.log("🔄 signIn called");

    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, signInWithEmailAndPassword } = await import(
        "firebase/auth"
      );

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const app =
        getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const auth = getAuth(app);

      console.log("✅ Auth available for signIn:", !!auth);

      if (!auth) {
        throw new Error("Auth service not available");
      }

      await signInWithEmailAndPassword(auth, email, password);
      console.log("✅ signInWithEmailAndPassword completed");
    } catch (error) {
      console.error("❌ signIn error:", error);
      throw error;
    }
  }

  async function signUp(email: string, password: string, name: string) {
    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, createUserWithEmailAndPassword, updateProfile } =
        await import("firebase/auth");

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const app =
        getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const auth = getAuth(app);

      if (!auth) {
        throw new Error("Auth service not available");
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (userCredential.user) {
        await updateProfile(userCredential.user, { displayName: name });
      }
    } catch (error) {
      console.error("❌ signUp error:", error);
      throw error;
    }
  }

  async function signInWithGoogle() {
    console.log("🔄 signInWithGoogle called");

    try {
      const { initializeApp, getApps } = await import("firebase/app");
      const { getAuth, signInWithPopup, GoogleAuthProvider } = await import(
        "firebase/auth"
      );

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const app =
        getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
      const auth = getAuth(app);

      console.log("✅ Auth available for Google signIn:", !!auth);

      if (!auth) {
        throw new Error("Auth service not available");
      }

      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      console.log("✅ signInWithPopup completed");
    } catch (error) {
      console.error("❌ signInWithGoogle error:", error);
      throw error;
    }
  }

  async function logout() {
    try {
      const { getAuth, signOut } = await import("firebase/auth");
      const auth = getAuth();

      if (!auth) {
        throw new Error("Auth service not available");
      }

      await signOut(auth);
    } catch (error) {
      console.error("❌ logout error:", error);
      throw error;
    }
  }

  async function resetPassword(email: string) {
    try {
      const { getAuth, sendPasswordResetEmail } = await import("firebase/auth");
      const auth = getAuth();

      if (!auth) {
        throw new Error("Auth service not available");
      }

      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("❌ resetPassword error:", error);
      throw error;
    }
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
