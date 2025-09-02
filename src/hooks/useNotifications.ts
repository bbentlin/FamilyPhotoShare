import { useCallback, useMemo } from "react";
import { collection, query, where, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import type { InAppNotification } from "@/lib/notifications";

export function useNotifications(enableRealtime = true) {
  const { user } = useAuth();

  const notifQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
  }, [user]);

  const {
    data,
    loading,
    error,
    isStale,
    refetch,
  } = useCachedFirebaseQuery<InAppNotification>(notifQuery, {
    cacheKey: "notifications",
    cacheTtl: CACHE_CONFIGS.recent.ttl,
    enableRealtime,
    staleWhileRevalidate: true,
  });

  const unreadCount = (data || []).filter((n) => !n.read).length;

  const markAsRead = useCallback(async (id: string) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
  }, []);

  const markAllAsRead = useCallback(async (id: string) => {
    if (!data) return;
    await Promise.all(
      data.filter((n: any) => !n.read).map((n: any) => updateDoc(doc(db, "notifications", n.id), { read: true }))
    );
  }, [data]);

  return { notifications: data, loading, error, isStale, refetch, unreadCount, markAsRead, markAllAsRead };
}