import { useState, useEffect, useCallback, useRef } from "react";
import { DocumentReference, onSnapshot, getDoc, DocumentData } from "firebase/firestore";
import { firebaseCache } from "@/lib/firebaseCache";

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
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const isMountedRef = useRef(true);

  const {
    cacheKey,
    cacheTtl = 5 * 60 * 1000, // 5 minutes default
    enableRealtime = false,
    staleWhileRevalidate = true
  } = options;

  // Check if data is cached and valid
  const getCachedData = useCallback(() => {
    if (!docRef) return null;
    return firebaseCache.get<T>(cacheKey);
  }, [cacheKey, docRef]);

  // Fetch fresh data from Firestore
  const fetchFreshData = useCallback(async (): Promise<T | null> => {
    if (!docRef) return null;

    try {
      const docSnap = await  getDoc(docRef);
      if (docSnap.exists()) {
        const docData = { id: docSnap.id, ...docSnap.data() } as T;

        // Cache the fresh data
        return docData;
      } else {
        return null;
      }
    } catch (err) {
      console.error('Error fetching document:', err);
      throw err;
    }
  }, [docRef, cacheKey, cacheTtl]);

  // Refetch function
  const refetch = useCallback(async () => {
    if (!docRef || !isMountedRef.current) return;
    
    try {
      setError(null);
      setIsStale(false);
      const freshData = await fetchFreshData();

      if (isMountedRef.current) {
        setData(freshData);
        setLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    }
  }, [docRef, fetchFreshData]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!docRef) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    const loadData = async () => {
      try {
        setError(null);

        // Check cache first
        const cachedData = getCachedData();
        const isCacheValid = cachedData !== null;

        if (cachedData && isCacheValid) {
          // Use cached data immediately
          setData(cachedData);
          setLoading(false);
          setIsStale(false);

          // If staleWhileRevalidate is enabled, fetch fresh data in background
          if (staleWhileRevalidate) {
            setIsStale(true);
            try {
              const freshData = await fetchFreshData();
              if (isMountedRef.current && freshData) {
                setData(freshData);
                setIsStale(false);
              }
            } catch (err) {
              console.error('Background refresh failed:', err);
              setIsStale(false);
            }
          }
        } else {
          // No valid cache, fetch fresh data
          setLoading(true);
          const freshData = await fetchFreshData();

          if (isMountedRef.current) {
            setData(freshData);
            setLoading(false);
          }
        }

        // Set up real-time listener if enabled
        if (enableRealtime && isMountedRef.current) {
          unsubscribeRef.current = onSnapshot(
            docRef,
            (docSnap) => {
              if (!isMountedRef.current ) return;

              if (docSnap.exists()) {
                const docData = { id: docSnap.id, ...docSnap.data() } as T;

                // Update cache
                firebaseCache.set(cacheKey, docData, { ttl: cacheTtl });

                setData(docData);
                setIsStale(false);
              } else {
                setData(null);
              }
              setLoading(false);
              setError(null);
            },
            (err) => {
              if (!isMountedRef.current) return;
              console.error('Real-time listener error:', err);
              setError(err.message);
              setLoading(false);
            }
          );
        }

      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Unknown error ');
        }
      }
    };

    loadData();

    // Clean up function
    return () => {
      isMountedRef.current = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      } 
    };
  }, [docRef, cacheKey, enableRealtime, getCachedData, fetchFreshData, cacheTtl, staleWhileRevalidate]);

  // Cleanup on unmount
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
    refetch
  };
}