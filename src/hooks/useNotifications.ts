import { useCallback, useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs, // ✅ Changed from onSnapshot to getDocs
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { InAppNotification } from "@/lib/notifications";

export function useNotifications(subscribe = false) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setData([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(50)
    );

    // ✅ ALWAYS use one-time fetch instead of real-time
    async function fetchOnce() {
      setLoading(true);
      try {
        const snap = await getDocs(q);
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (error: any) {
        console.error("Error fetching notifications:", error);
        if (error.code === "permission-denied") {
          console.warn(
            "Permission denied for notifications - user may not have access"
          );
          setData([]);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchOnce();
  }, [user?.uid]); // Removed subscribe dependency

  const markAsRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), { read: true });
      // Manually update local state
      setData((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: true } : item))
      );
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!data) return;
    try {
      await Promise.all(
        data
          .filter((n: any) => !n.read)
          .map((n: any) =>
            updateDoc(doc(db, "notifications", n.id), { read: true })
          )
      );
      // Manually update local state
      setData((prev) => prev.map((item) => ({ ...item, read: true })));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  }, [data]);

  return {
    notifications: data,
    unreadCount: data.filter((n) => !n.read).length,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
