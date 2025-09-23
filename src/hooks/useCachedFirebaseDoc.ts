import { useState, useEffect, useCallback, useRef } from "react";
import {
  DocumentReference,
  onSnapshot,
  getDoc,
  DocumentData,
  DocumentSnapshot,
  FirestoreError,
} from "firebase/firestore";
import { firebaseCache } from "@/lib/firebaseCache";
import { useAuth } from "@/context/AuthContext";

interface UseCachedFirebaseDocOptions {
  cacheKey: string;
  cacheTtl?: number;
  enableRealtime?: boolean;
  staleWhileRevalidate?: boolean;
}

interface UseCachedFirebaseDocResult<T = DocumentData> {
  data: T | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
  refetch: () => Promise<void>;
}

export function useCachedFirebaseDoc<T = DocumentData>(
  docRef: DocumentReference | null,
  options: UseCachedFirebaseDocOptions
): UseCachedFirebaseDocResult<T> {
  const { user } = useAuth();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  const {
    cacheKey,
    cacheTtl = 5 * 60 * 1000,
    enableRealtime = false,
    staleWhileRevalidate = true,
  } = options;

  const getCachedData = useCallback(() => {
    if (!docRef || !user) return null;
    return firebaseCache.get<T>(cacheKey);
  }, [cacheKey, docRef, user]);

  const fetchFreshData = useCallback(async (): Promise<T | null> => {
    if (!docRef || !user) return null;

    try {
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const docData = { id: docSnap.id, ...docSnap.data() } as T;
        firebaseCache.set(cacheKey, docData, { ttl: cacheTtl });
        return docData;
      } else {
        return null;
      }
    } catch (err: any) {
      if (err.code === "permission-denied") {
        console.warn(
          "Permission denied for document - user may not have access"
        );
        return null;
      }
      console.error("Error fetching document:", err);
      throw err;
    }
  }, [docRef, cacheKey, cacheTtl, user]);

  const refetch = useCallback(async () => {
    if (!docRef || !isMountedRef.current || !user) return;

    try {
      setError(null);
      setIsStale(false);
      const freshData = await fetchFreshData();

      if (isMountedRef.current) {
        setData(freshData);
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        if (err.code === "permission-denied") {
          setError(null);
          setData(null);
        } else {
          setError(err.message || "Unknown error");
        }
        setLoading(false);
      }
    }
  }, [docRef, fetchFreshData, user]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!docRef || !user) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const loadData = async () => {
      try {
        setError(null);

        const cachedData = getCachedData();
        const isCacheValid = cachedData !== null;

        if (cachedData && isCacheValid) {
          setData(cachedData);
          setLoading(false);
          setIsStale(false);

          if (staleWhileRevalidate) {
            setIsStale(true);
            try {
              const freshData = await fetchFreshData();
              if (isMountedRef.current && freshData) {
                setData(freshData);
                setIsStale(false);
              }
            } catch (err) {
              console.error("Background refresh failed:", err);
              setIsStale(false);
            }
          }
        } else {
          setLoading(true);
          const freshData = await fetchFreshData();

          if (isMountedRef.current) {
            setData(freshData);
            setLoading(false);
          }
        }

        // Real-time listener (only if explicitly enabled AND we have a docRef)
        if (enableRealtime && docRef) {
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
          }
          unsubscribeRef.current = onSnapshot(
            docRef as DocumentReference<DocumentData>,
            (docSnap: DocumentSnapshot<DocumentData>) => {
              if (!isMountedRef.current) return;
              if (docSnap.exists()) {
                const docData = {
                  id: docSnap.id,
                  ...docSnap.data(),
                } as T;
                firebaseCache.set(cacheKey, docData, { ttl: cacheTtl });
                setData(docData);
                setIsStale(false);
              } else {
                setData(null);
              }
              setLoading(false);
              setError(null);
            },
            (err: FirestoreError) => {
              if (!isMountedRef.current) return;
              console.error("Real-time listener error:", err);
              if (err.code === "permission-denied") {
                setError(null);
              } else {
                setError(err.message);
              }
              setLoading(false);
            }
          );
        }
      } catch (err: any) {
        if (isMountedRef.current) {
          if (err.code === "permission-denied") {
            setData(null);
            setError(null);
          } else {
            setError(err.message || "Unknown error");
          }
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [
    docRef,
    cacheKey,
    enableRealtime,
    getCachedData,
    fetchFreshData,
    cacheTtl,
    staleWhileRevalidate,
    user,
  ]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, []);

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
  };
}
