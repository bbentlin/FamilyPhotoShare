import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Query,
  onSnapshot,
  getDocs,
  DocumentData,
  QuerySnapshot,
} from "firebase/firestore";
import { firebaseCache, CACHE_CONFIGS } from "@/lib/firebaseCache";
import { useAuth } from "@/context/AuthContext";

// No db or getDb import is needed here, as the query is passed in fully formed.

interface UseCachedFirebaseQueryOptions {
  cacheKey: string;
  cacheTtl?: number;
  enableRealtime?: boolean;
  staleWhileRevalidate?: boolean;
}

export function useCachedFirebaseQuery<T = DocumentData>(
  query: Query | null,
  options: UseCachedFirebaseQueryOptions
) {
  const { user } = useAuth();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any>(null);
  const [isStale, setIsStale] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);

  const fetchData = useCallback(
    async (isStaleRefresh = false) => {
      if (!query || !user) {
        setLoading(false);
        return;
      }

      const cacheKey = `${options.cacheKey}_${user.uid}`;

      if (!isStaleRefresh) {
        const cached = firebaseCache.get<T[]>(cacheKey);
        if (cached) {
          setData(cached);
          setLoading(false);
          if (options.staleWhileRevalidate) {
            setIsStale(true);
            fetchData(true); // Fetch in background
          }
          return;
        }
      }

      // Not in cache or stale, fetch from Firestore
      try {
        const snapshot = await getDocs(query);
        const docs = snapshot.docs.map(
          (doc) => ({ id: doc.id, ...doc.data() } as T)
        );

        setData(docs);
        setError(null);
        setIsStale(false);
        firebaseCache.set(cacheKey, docs, { ttl: options.cacheTtl });
      } catch (err: any) {
        console.error("Firebase query error:", err);
        setError(err);
      } finally {
        if (!isStaleRefresh) {
          setLoading(false);
        }
      }
    },
    [
      query,
      user,
      options.cacheKey,
      options.cacheTtl,
      options.staleWhileRevalidate,
    ]
  );

  useEffect(() => {
    if (!query || !user) {
      setData([]);
      setLoading(true);
      return;
    }

    if (options.enableRealtime) {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      const unsubscribe = onSnapshot(
        query,
        (snapshot: QuerySnapshot) => {
          const freshData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as T[];

          setData(freshData);
          setError(null);
          setLoading(false);
          setIsStale(false);
          firebaseCache.set(`${options.cacheKey}_${user.uid}`, freshData, {
            ttl: options.cacheTtl,
          });
        },
        (err) => {
          console.error("Realtime listener error:", err);
          setError(err);
          setLoading(false);
        }
      );
      unsubscribeRef.current = unsubscribe;
    } else {
      fetchData();
    }

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
    };
  }, [query, user, options.enableRealtime, fetchData]);

  const refetch = useCallback(() => {
    if (query && user) {
      setLoading(true);
      const cacheKey = `${options.cacheKey}_${user.uid}`;
      firebaseCache.invalidate(cacheKey);
      fetchData();
    }
  }, [query, user, options.cacheKey, fetchData]);

  const emptyResult = useMemo(
    () => ({
      data: [],
      loading: false,
      error: null,
      isStale: false,
      refetch: () => {},
      invalidateCache: () => {},
    }),
    []
  );

  if (!query || !user) {
    return emptyResult;
  }

  return {
    data,
    loading,
    error,
    isStale,
    refetch,
  };
}
