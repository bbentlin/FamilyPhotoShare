import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import type { User } from "firebase/auth";

export async function ensureUserDoc(u: User) {
  const db = getDb();
  const ref = doc(db, "users", u.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: u.uid,
      email: u.email || "",
      displayName: u.displayName || "",
      photoURL: u.photoURL || "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return;
  }

  const data = snap.data() as any;
  const patch: any = {};

  if (!("emailNotifications" in data)) patch.emailNotifications = true;
  if (!("newUploadsNotification" in data)) patch.newUploadsNotification = true;
  if (!("commentsNotification" in data)) patch.commentsNotification = true;

  if (data.email !== (u.email ?? null)) patch.email = u.email ?? null;
  if (data.displayName !== (u.displayName ?? null))
    patch.displayName = u.displayName ?? null;

  if (Object.keys(patch).length) {
    patch.updatedAt = serverTimestamp();
    await setDoc(ref, patch, { merge: true });
  }
}

export async function saveNotificationPrefs(
  uid: string,
  prefs: {
    emailNotifications: boolean;
    newUploadsNotification: boolean;
    commentsNotification: boolean;
  }
) {
  const db = getDb();
  const ref = doc(db, "users", uid);
  await updateDoc(ref, { ...prefs, updatedAt: serverTimestamp() });
}
