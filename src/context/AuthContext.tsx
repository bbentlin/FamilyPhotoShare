"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User } from "firebase/auth";
import { getFirebaseAuth, getFirebaseDb, getGoogleProvider } from "@/lib/firebase";

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
  const [firebaseServices, setFirebaseServices] = useState<{
    auth: any;
    db: any;
    googleProvider: any;
  }>({
    auth: null,
    db: null,
    googleProvider: null,
  });

  // Initialize Firebase services
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const initializeServices = async () => {
      try {
        const [auth, db, googleProvider] = await Promise.all([
          getFirebaseAuth(),
          getFirebaseDb(),
          getGoogleProvider(),
        ]);

        setFirebaseServices({ auth, db, googleProvider });

        if (auth) {
          // Import Firebase Auth functions dynamically
          const { 
            onAuthStateChanged, 
            setPersistence, 
            browserSessionPersistence 
          } = await import('firebase/auth');
          
          const { 
            doc, 
            getDoc, 
            setDoc, 
            updateDoc, 
            serverTimestamp 
          } = await import('firebase/firestore');

          // Set persistence
          try {
            await setPersistence(auth, browserSessionPersistence);
            console.log("Auth persistence set to session-only");
          } catch (error) {
            console.error("Error setting auth persistence:", error);
          }

          // Set up auth state listener
          const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
              setUser(user);

              // CREATE/UPDATE USER DOCUMENT IN FIRESTORE
              if (db) {
                try {
                  const userRef = doc(db, "users", user.uid);
                  const userDoc = await getDoc(userRef);

                  if (!userDoc.exists()) {
                    console.log("Creating user document for:", user.email);
                    await setDoc(userRef, {
                      uid: user.uid,
                      email: user.email,
                      displayName:
                        user.displayName || user.email?.split("@")[0] || "Unknown User",
                      photoURL: user.photoURL,
                      createdAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                      lastLoginAt: serverTimestamp(),
                    });
                    console.log("User document created successfully");
                  } else {
                    console.log("Updating user document for:", user.email);
                    await updateDoc(userRef, {
                      displayName:
                        user.displayName || user.email?.split("@")[0] || "Unknown User",
                      photoURL: user.photoURL,
                      lastLoginAt: serverTimestamp(),
                      updatedAt: serverTimestamp(),
                    });
                    console.log("User document updated successfully");
                  }
                } catch (error) {
                  console.error("Error creating/updating user document:", error);
                }
              }
            } else {
              setUser(null);
            }
            setLoading(false);
          });

          return unsubscribe;
        }
      } catch (error) {
        console.error('Failed to initialize Firebase services:', error);
        setLoading(false);
      }
    };

    let unsubscribe: (() => void) | undefined;
    
    initializeServices().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  async function signUp(email: string, password: string, name: string) {
    if (!firebaseServices.auth || !firebaseServices.db) {
      throw new Error("Firebase services not available");
    }

    try {
      const { 
        createUserWithEmailAndPassword, 
        updateProfile,
        setPersistence,
        browserSessionPersistence 
      } = await import('firebase/auth');
      
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');

      await setPersistence(firebaseServices.auth, browserSessionPersistence);

      const userCredential = await createUserWithEmailAndPassword(
        firebaseServices.auth,
        email,
        password
      );

      if (userCredential.user) {
        await updateProfile(userCredential.user, {
          displayName: name,
        });

        await setDoc(doc(firebaseServices.db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          displayName: name,
          email: email,
          photoURL: null,
          emailNotifications: true,
          newUploadsNotification: true,
          commentsNotification: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          lastLoginAt: serverTimestamp(),
          provider: "email",
        });
        console.log("User document created during signup for:", email);
      }
    } catch (error) {
      console.error("Error signing up:", error);
      throw error;
    }
  }

  async function signIn(email: string, password: string) {
    if (!firebaseServices.auth) {
      throw new Error("Firebase Auth not available");
    }

    try {
      const { 
        signInWithEmailAndPassword,
        setPersistence,
        browserSessionPersistence 
      } = await import('firebase/auth');

      await setPersistence(firebaseServices.auth, browserSessionPersistence);
      await signInWithEmailAndPassword(firebaseServices.auth, email, password);
    } catch (error) {
      console.error("Error signing in:", error);
      throw error;
    }
  }

  async function signInWithGoogle() {
    if (!firebaseServices.auth || !firebaseServices.db || !firebaseServices.googleProvider) {
      throw new Error("Firebase services not available");
    }

    try {
      const { 
        signInWithPopup,
        setPersistence,
        browserSessionPersistence 
      } = await import('firebase/auth');
      
      const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore');

      await setPersistence(firebaseServices.auth, browserSessionPersistence);

      const result = await signInWithPopup(firebaseServices.auth, firebaseServices.googleProvider);
      const user = result.user;

      if (firebaseServices.db) {
        const userDocRef = doc(firebaseServices.db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (!userDoc.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            displayName:
              user.displayName || user.email?.split("@")[0] || "Google User",
            email: user.email,
            photoURL: user.photoURL,
            emailNotifications: true,
            newUploadsNotifications: true,
            commentsNotification: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastLoginAt: serverTimestamp(),
            provider: "google",
          });
          console.log("User document created during Google signin for:", user.email);
        }
      }
    } catch (error) {
      console.error("Error signing in with Google:", error);
      throw error;
    }
  }

  async function logout() {
    if (!firebaseServices.auth) {
      throw new Error("Firebase Auth not available");
    }

    try {
      const { signOut } = await import('firebase/auth');
      await signOut(firebaseServices.auth);
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  async function resetPassword(email: string) {
    if (!firebaseServices.auth) {
      throw new Error("Firebase Auth not available");
    }

    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      await sendPasswordResetEmail(firebaseServices.auth, email);
    } catch (error) {
      console.error("Error sending password reset email:", error);
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
