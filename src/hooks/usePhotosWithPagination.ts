import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
  QueryConstraint,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Photo } from "@/types";
import { firebaseCache, CACHE_CONFIGS } from "@/lib/firebaseCache";

export function usePhotosWithPagination(
  pageSize: number = 20,
  sortBy: "newest" | "oldest" | "title" = "newest"
) {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const isInitialLoad = useRef(true);
  const [error, setError] = useState<string | null>(null);

  const createQuery = useCallback(
    (startAfterDoc?: any) => {
      if (!db || !user) return null;

      const photosRef = collection(db, "photos");
      let q;

      if (sortBy === "newest") {
        q = query(photosRef, orderBy("createdAt", "desc"), limit(pageSize));
      } else if (sortBy === "oldest") {
        q = query(photosRef, orderBy("createdAt", "asc"), limit(pageSize));
      } else {
        q = query(photosRef, orderBy("title", "asc"), limit(pageSize));
      }

      if (startAfterDoc) {
        q = query(
          photosRef,
          orderBy("createdAt", "desc"),
          startAfter(startAfterDoc),
          limit(pageSize)
        );
      }

      return q;
    },
    [db, user, sortBy, pageSize]
  );

  const fetchPhotos = useCallback(
    async (isLoadMore = false) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const targetLoading = isLoadMore ? setLoadingMore : setLoading;
        targetLoading(true);
        setError(null);

        // For initial load, try cache first
        if (!isLoadMore && isInitialLoad.current) {
          const cacheKey = `photos_${sortBy}_page1`;
          const cached = firebaseCache.get<Photo[]>(
            "photos",
            { sortBy, page: 1 },
            user.uid
          );

          if (cached && cached.length > 0) {
            setPhotos(cached);
            setLoading(false);
            isInitialLoad.current = false;

            // Continue with background refresh
            setTimeout(() => fetchPhotos(false), 100);
            return;
          }
        }

        const firebaseQuery = createQuery(
          isLoadMore ? lastDoc ?? undefined : undefined
        );
        if (!firebaseQuery) return;

        const snapshot = await getDocs(firebaseQuery);
        const newPhotos = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Photo[];

        if (isLoadMore) {
          setPhotos((prev) => [...prev, ...newPhotos]);
        } else {
          setPhotos(newPhotos);

          // Cache first page for quick access
          if (newPhotos.length > 0) {
            firebaseCache.set(
              "photos",
              newPhotos,
              CACHE_CONFIGS.photos,
              { sortBy, page: 1 },
              user.uid
            );
          }
        }

        // Update pagination state
        const lastDocument = snapshot.docs[snapshot.docs.length - 1];
        setLastDoc(lastDocument || null);
        setHasMore(newPhotos.length === pageSize);

        isInitialLoad.current = false;
      } catch (err) {
        console.error("Error fetching photos:", err);
        setError(err instanceof Error ? err.message : "Failed to load photos");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [user, createQuery, lastDoc, pageSize, sortBy] 
  );

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPhotos(true);
    }
  }, [fetchPhotos, loadingMore, hasMore]);

  const refresh = useCallback(() => {
    // Clear cache and reload
    if (user) {
      firebaseCache.invalidate("photos", undefined, user.uid);
    }
    setLastDoc(null);
    setHasMore(true);
    isInitialLoad.current = true;
    fetchPhotos(false);
  }, [fetchPhotos, user]);

  // Effect for initial load and sort changes
  useEffect(() => {
    setLastDoc(null);
    setHasMore(true);
    setPhotos([]);
    isInitialLoad.current = true;
    fetchPhotos(false);
  }, [user, sortBy]); // Note: Don't include fetchPhotos to avoid infinite loop

  return {
    photos,
    loading,
    loadingMore,
    hasMore,
    error,
    loadMore,
    refresh,
  };
}