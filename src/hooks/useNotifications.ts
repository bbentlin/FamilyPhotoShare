import { useCallback, useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
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

    let unsub: undefined | (() => void);

    async function fetchOnce() {
      setLoading(true);
      const snap = await getDocs(q);
      setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    }

    if (subscribe) {
      setLoading(true);
      unsub = onSnapshot(q, (snap) => {
        setData(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    } else {
      fetchOnce();
    }

    return () => {
      if (unsub) unsub();
    };
  }, [subscribe, user?.uid]);

  const markAsRead = useCallback(async (id: string) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
  }, []);

  const markAllAsRead = useCallback(
    async (id: string) => {
      if (!data) return;
      await Promise.all(
        data
          .filter((n: any) => !n.read)
          .map((n: any) =>
            updateDoc(doc(db, "notifications", n.id), { read: true })
          )
      );
    },
    [data]
  );

  return {
    notifications: data,
    unreadCount: data.filter((n) => !n.read).length,
    loading,
    markAsRead,
    markAllAsRead,
  };
}
