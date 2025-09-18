import { db } from "@/lib/firebase";
import {
  arrayUnion,
  doc,
  serverTimestamp,
  setDoc,
  writeBatch,
  increment,
} from "firebase/firestore";

export async function addPhotoToAlbums(
  photoId: string,
  albumIds: string[],
  opts?: { addedBy?: string }
) {
  if (!photoId || albumIds.length === 0) return;

  const batch = writeBatch(db);

  for (const albumId of albumIds) {
    // albums/{albumId}/photos/{photoId} linkage (idempotent)
    const albumPhotoRef = doc(db, "albums", albumId, "photos", photoId);
    batch.set(
      albumPhotoRef,
      {
        photoId,
        albumId,
        addedAt: serverTimestamp(),
        ...(opts?.addedBy ? { addedBy: opts.addedBy } : {}),
      },
      { merge: true }
    );

    // Touch album and increment count
    const albumRef = doc(db, "albums", albumId);
    batch.set(
      albumRef,
      {
        updatedAt: serverTimestamp(),
        photoCount: increment(1), // <-- keep album tiles in sync
      },
      { merge: true }
    );
  }

  // photos/{photoId} -> albums: arrayUnion(albumIds...)
  const photoRef = doc(db, "photos", photoId);
  batch.set(
    photoRef,
    {
      albums: arrayUnion(...albumIds), // works even if field doesn’t exist
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}
