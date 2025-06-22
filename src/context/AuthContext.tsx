"use client"

import { createContext, useContext, useEffect, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  setPersistence,
  browserSessionPersistence
} from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";

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
    // Set session persistence on mount
    const initializeAuth = async () => {
      try {
        await setPersistence(auth, browserSessionPersistence);
        console.log("Auth persistence set to session-only");
      } catch (error) {
        console.error("Error setting auth persistence:", error);
      }
    };

    initializeAuth();

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  async function signUp(email: string, password: string, name: string) {
    try {
      // Ensure session persistence before signup
      await setPersistence(auth, browserSessionPersistence);

      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      // Update profile with display name
      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: name
        });

        // Create user document in Firestore
        await setDoc(doc(db, "users", userCredential.user.uid), {
          displayName: name,
          email: email,
          emailNotifications: true,
          newUploadsNotification: true,
          commentsNotification: true,
          createdAt: new Date().toISOString(),
          provider: "email"
        });
      }
    } catch (error) {
      console.error("Error signing up:", error);
      throw error;
    }
  }

  async function signIn(email: string, password: string) {
    try {
      // Ensure session persistence before signin
      await setPersistence(auth, browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  async function signInWithGoogle() {
    try {
      // Ensure session persistence before signin
      await setPersistence(auth, browserSessionPersistence);

      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Check if user document exists, create if not
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (!userDoc.exists()) {
        // Create user document for new Google users
        await setDoc(userDocRef, {
          displayName: user.displayName || user.email?.split("@")[0] || "Google User",
          email: user.email,
          photoURL: user.photoURL,
          emailNotifications: true,
          newUploadsNotifications: true,
          commentsNotification: true,
          createdAt: new Date().toISOString(),
          provider: "google"
        });
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  }

  async function logOut() {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
      throw error;
    }
  }

  async function resetPassword(email: string) {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error("Error resetting password:", error);
      throw error;
    }
  }

  const value = {
    user, 
    loading,
    signUp,
    signIn,
    signInWithGoogle,
    logout: logOut,
    resetPassword
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