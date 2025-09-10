"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "firebase/auth";
import {
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
import { ensureUserDoc } from "@/lib/user";
import { getClientAuth } from "@/lib/firebase.client";

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
    let unsub: undefined | (() => void);
    (async () => {
      const auth = await getClientAuth();
      // Session-only persistence (clears on browser close)
      try {
        await setPersistence(auth, browserSessionPersistence);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[Auth] setPersistence failed:", e);
      }
      unsub = onAuthStateChanged(
        auth,
        async (u) => {
          setUser(u);
          setLoading(false);
          if (u) {
            try {
              await ensureUserDoc(u);
            } catch (e) {
              // eslint-disable-next-line no-console
              console.warn("[Auth] ensureUserDoc failed:", e);
            }
          }
        },
        (err) => {
          // eslint-disable-next-line no-console
          console.error("❌ [Auth] listener error:", err);
          setLoading(false);
        }
      );
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      signIn: async (email: string, password: string) => {
        const auth = await getClientAuth();
        await signInWithEmailAndPassword(auth, email, password);
      },
      signUp: async (email: string, password: string, name: string) => {
        const auth = await getClientAuth();
        const cred = await createUserWithEmailAndPassword(
          auth,
          email,
          password
        );
        if (cred.user) {
          await updateProfile(cred.user, { displayName: name });
          try {
            await ensureUserDoc(cred.user);
          } catch (e) {
            // eslint-disable-next-line no-console
            console.warn("[Auth] ensureUserDoc after signup failed:", e);
          }
        }
      },
      signInWithGoogle: async () => {
        const auth = await getClientAuth();
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      },
      logout: async () => {
        const auth = await getClientAuth();
        await signOut(auth);
      },
      resetPassword: async (email: string) => {
        const auth = await getClientAuth();
        await sendPasswordResetEmail(auth, email);
      },
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
