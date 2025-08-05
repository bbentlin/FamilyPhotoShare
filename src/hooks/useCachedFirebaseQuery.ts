import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  Query,
  onSnapshot,
  getDocs,
  DocumentData,
  QuerySnapshot
} from 'firebase/firestore';
import { firebaseCache, CACHE_CONFIGS } from "@/lib/firebaseCache";
import { useAuth } from "@/context/AuthContext";

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
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const queryRef = useRef<Query | null>(null);

  const fetchData = useCallback(async (skipCache = false) => {
    if (!query) return { loading: false, data: []}

    try {
      const cacheKey = `${options.cacheKey}_${user?.uid || 'anonymous'}`;

      // Try cache first (unless skipping)
      if (!skipCache) {
        const cached = firebaseCache.get<T[]>(
          options.cacheKey,
          { query: query.toString() },
          user?.uid
        );

        if (cached) {
          setData(cached);
          setLoading(false);

          if (options.staleWhileRevalidate) {
            setIsStale(true);
            // Continue to fetch fresh data in background
          } else {
            return;
          }
        }
      }

      // Fetch from Firebase
      const snapshot = await getDocs(query);
      const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as T));
      setData(docs);
      setLoading(false); // <-- make sure this is here!

      // Update state
      setIsStale(false);
      setLoading(false);
      setError(null);

      // Cache the result
      firebaseCache.set(
        options.cacheKey,
        docs,
        { ttl: options.cacheTtl },
        { query: query.toString() },
        user?.uid
      );

    } catch (err) {
      console.error('Firebase query error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }, [query, options.cacheKey, options.cacheTtl, options.staleWhileRevalidate, user?.uid]);

  const setupRealtime = useCallback(() => {
    if (!query || !options.enableRealtime) return;

    // Clean up previous listener
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    const unsubscribe = onSnapshot(
      query,
      (snapshot: QuerySnapshot) => {
        const freshData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as T[];

        setData(freshData);
        setIsStale(false);
        setError(null);
        setLoading(false);

        // Update cache with real-time data
        firebaseCache.set(
          options.cacheKey,
          freshData,
          { ttl: options.cacheTtl },
          { query: query.toString() },
          user?.uid
        );
      },
      (err) => {
        console.error('Realtime listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;
  }, [query, options.enableRealtime, options.cacheKey, options.cacheTtl, user?.uid]);

  // Effect to handle query changes
  useEffect(() => {
    if (!query) {
      setData([]);
      setLoading(false);
      return;
    }

    // If query changed, reset states
    if (queryRef.current !== query) {
      setLoading(true);
      setError(null);
      queryRef.current = query;
    }

    if (options.enableRealtime) {
      setupRealtime();
    } else {
      fetchData();
    }

    return () =>  {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [query, fetchData, setupRealtime, options.enableRealtime]);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchData(true); // Skip cache
  }, [fetchData]);

  const invalidateCache = useCallback(() => {
    firebaseCache.invalidate(
      options.cacheKey,
      { query: query?.toString() },
      user?.uid
    );
  }, [options.cacheKey, query, user?.uid]);

  // If query is null, immediately return not loading and empty data (memoized)
  const emptyResult = useMemo(() => ({
    data: [],
    loading: false,
    error: null,
    isStale: false,
    refetch: () => {},
    invalidateCache: () => {},
  }), []);

  if (!query) {
    return emptyResult;
  }

  return {
    data, 
    loading,
    error,
    isStale,
    refetch,
    invalidateCache,
  };
}