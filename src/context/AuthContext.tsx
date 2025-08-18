"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { ensureUserDoc } from "@/lib/user";

interface AuthContextProps {
  user: User | null;
  loading: boolean;
  signUp(email: string, password: string, name: string): Promise<void>;
  signIn(email: string, password: string): Promise<void>;
  signInWithGoogle(): Promise<void>;
  logout(): Promise<void>;
  resetPassword(email: string): Promise<void>;
}

const AuthContext = createContext<AuthContextProps | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Force session-only auth (clears on browser close)
    setPersistence(auth, browserSessionPersistence).catch((e) =>
      console.warn("[Auth] setPersistence failed:", e)
    );

    console.log("🔄 [Auth] initializing…");
    let listenerFired = false;

    const unsubscribe = onAuthStateChanged(
      auth,
      async (u) => {
        listenerFired = true;
        console.log("🔄 [Auth] onAuthStateChanged:", u?.email ?? "null");
        setUser(u);
        setLoading(false);

        if (u) {
          // non-blocking user doc creation
          try {
            await ensureUserDoc(u); // <-- creates/patches prefs if missing
          } catch (e) {
            console.warn("[Auth] ensureUserDoc failed:", e);
          }
        }
      },
      (err) => {
        console.error("❌ [Auth] listener error:", err);
        setLoading(false);
      }
    );

    // fallback after 5s in case onAuthStateChanged never fires
    const timeout = setTimeout(() => {
      if (!listenerFired) {
        console.warn("⚠️ [Auth] listener never fired, forcing loading→false");
        setLoading(false);
      }
    }, 5000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function signUp(email: string, password: string, name: string) {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (cred.user) {
      await updateProfile(cred.user, { displayName: name });
      // Create/patch user doc immediately to avoid races
      try {
        await ensureUserDoc(cred.user);
      } catch (e) {
        console.warn("[Auth] ensureUserDoc after signup failed:", e);
      }
    }
  }

  async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  }

  async function logout() {
    await signOut(auth);
  }

  async function resetPassword(email: string) {
    await sendPasswordResetEmail(auth, email);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signUp,
        signIn,
        signInWithGoogle,
        logout,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
