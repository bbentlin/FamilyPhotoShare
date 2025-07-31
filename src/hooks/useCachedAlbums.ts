import { useMemo } from "react";
import { collection, query, orderBy, where } from 'firebase/firestore';
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Album } from "@/types";
import { useCachedFirebaseQuery } from "./useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";

export function useCachedAlbums(enableRealtime = false) {
  const { user } = useAuth();

  const albumsQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(db, 'albums'),
      where('members', 'array-contains', user.uid),
      orderBy('updatedAt', 'desc')
    );
  }, [user]);

  return useCachedFirebaseQuery<Album>(albumsQuery, {
    cacheKey: 'albums',
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime,
    staleWhileRevalidate: true,
  });
}