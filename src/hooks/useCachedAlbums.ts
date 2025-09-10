import { useMemo } from "react";
import { collection, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Album } from "@/types";
import { useCachedFirebaseQuery } from "./useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";

export function useCachedAlbums(enableRealtime: boolean = false) {
  const { user } = useAuth();

  const albumsQuery = useMemo(() => {
    if (!user || !db) {
      return null;
    }

    // Show all family albums, not just user's own albums
    return query(collection(db, "albums"), orderBy("createdAt", "desc"));
  }, [user, db]);

  const {
    data: albums,
    loading,
    error,
    refetch,
    isStale,
  } = useCachedFirebaseQuery<Album>(albumsQuery, {
    cacheKey: `family_albums`,
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime: false,
    staleWhileRevalidate: true,
  });

  return { albums, loading, error, refetch, isStale };
}
