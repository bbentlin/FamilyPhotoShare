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
        // Wait a bit for window to be fully ready
        await new Promise((resolve) => setTimeout(resolve, 100));

        const { getAuth } = await import("@/lib/firebase");
        const auth = getAuth();

        if (!auth) {
          console.error("❌ Auth service not available");
          setLoading(false);
          return;
        }

        console.log("✅ Auth service available, setting up listener...");

        const { onAuthStateChanged } = await import("firebase/auth");

        unsubscribe = onAuthStateChanged(auth, async (user) => {
          console.log(
            "🔄 Auth state changed:",
            user ? `User: ${user.email}` : "No user"
          );

          setUser(user);

          if (user) {
            // Optional: Create user document
            try {
              const { getDb } = await import("@/lib/firebase");
              const db = getDb();

              if (db) {
                const { doc, getDoc, setDoc, serverTimestamp } = await import(
                  "firebase/firestore"
                );
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
              }
            } catch (docError) {
              console.warn("⚠️ User document creation failed:", docError);
              // Don't fail auth because of this
            }
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
    const { getAuth } = await import("@/lib/firebase");
    const auth = getAuth();
    if (!auth) throw new Error("Auth not available");

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string, name: string) {
    const { getAuth } = await import("@/lib/firebase");
    const auth = getAuth();
    if (!auth) throw new Error("Auth not available");

    const { createUserWithEmailAndPassword, updateProfile } = await import(
      "firebase/auth"
    );
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
    const { getAuth } = await import("@/lib/firebase");
    const auth = getAuth();
    if (!auth) throw new Error("Auth not available");

    const { signInWithPopup, GoogleAuthProvider } = await import(
      "firebase/auth"
    );
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function logout() {
    const { getAuth } = await import("@/lib/firebase");
    const auth = getAuth();
    if (!auth) throw new Error("Auth not available");

    const { signOut } = await import("firebase/auth");
    await signOut(auth);
  }

  async function resetPassword(email: string) {
    const { getAuth } = await import("@/lib/firebase");
    const auth = getAuth();
    if (!auth) throw new Error("Auth not available");

    const { sendPasswordResetEmail } = await import("firebase/auth");
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
