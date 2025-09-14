import { db } from "@/lib/firebase";
import {
  arrayUnion,
  doc, 
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

export async function addPhotoToAlbums(photoId: string, albumIds: string[], opts?: { addedBy?: string }) {
  if (!photoId || albumIds.length === 0) return;

  const batch = writeBatch(db);

  for (const albumId of albumIds) {
    // albums/{albumId}/photos/{photoId}
    const albumPhotoRef = doc(db, "albums", albumId, "photos", photoId);
    batch.set(albumPhotoRef, {
      photoId,
      albumId,
      addedAt: serverTimestamp(),
      ...(opts?.addedBy ? { addedBy: opts.addedBy } : {}),
    }, { merge: true });

    // Optional: touch album updatedAt
    const albumRef = doc(db, "albums", albumId);
    batch.set(albumRef, { updatedAt: serverTimestamp() }, { merge: true });
  }

  // photos/{photoId} -> albums: arrayUnion(albumId)
  const photoRef = doc(db, "photos", photoId);
  batch.update(photoRef, {
    albums: arrayUnion(...albumIds),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}