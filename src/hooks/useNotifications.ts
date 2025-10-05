import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
  limit,
  updateDoc,
  doc,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

export function useNotifications(enabled: boolean) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !user) return;
    setLoading(true);
    const q = query(
      collection(db, "notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, [enabled, user]);

  const markAllRead = async () => {
    if (!user) return;
    const unread = items.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) =>
        updateDoc(doc(db, "notifications", n.id), { read: true })
      )
    );
  };

  return { items, loading, markAllRead };
}
