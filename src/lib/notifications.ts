import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "./firebase";

export async function notifyCommentOwner(params: {
  photoOwnerId: string;
  commenterName: string;
  commentText: string;
  photoTitle?: string;
  photoUrl?: string;
}) {
  const { photoOwnerId, commenterName, commentText, photoTitle, photoUrl } =
    params;

  try {
    const snap = await getDoc(doc(db, "users", photoOwnerId));
    if (!snap.exists()) return;

    const u = snap.data() as any;
    const to = u.email || u.emailAddress;
    const allow =
      (u.emailNotifications ?? true) && (u.commentsNotification ?? true);
    if (!allow || !to) return;

    const subject = `New comment on your photo${
      photoTitle ? `: ${photoTitle}` : ""
    }`;
    const message = `${commenterName} commented: "${commentText}"${
      photoUrl ? `\n\nView: ${photoUrl}` : ""
    }`;

    await fetch("/api/notifications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, message, type: "comment" }),
    });
  } catch (e) {
    console.warn("[notify] comment owner failed:", e);
  }
}

export async function notifyNewUploadSubscribers(params: {
  uploaderId: string;
  uploaderName: string;
  photoTitle?: string;
  photoUrl?: string;
}) {
  const { uploaderId, uploaderName, photoTitle, photoUrl } = params;

  try {
    const q = query(
      collection(db, "users"),
      where("emailNotifications", "==", true),
      where("newUploadsNotification", "==", true)
    );
    const snap = await getDocs(q);

    const recipients: string[] = [];
    snap.forEach((d) => {
      if (d.id === uploaderId) return;
      const u = d.data() as any;
      if (u.email) recipients.push(u.email);
    });

    if (recipients.length === 0) return;

    const subject = `${uploaderName} uploaded a new photo${
      photoTitle ? `: ${photoTitle}` : ""
    }`;
    const message = `${uploaderName} just uploaded a photo.${
      photoTitle ? `\nTitle: ${photoTitle}` : ""
    }${photoUrl ? `\n\nView: ${photoUrl}` : ""}`;

    // Send individually to avoid exposing addresses
    await Promise.all(
      recipients.map((to) =>
        fetch("/api/notifications/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to, subject, message, type: "new_upload" }),
        }).catch(() => null)
      )
    );
  } catch (e) {
    console.warn("[notify] new upload failed:", e);
  }
}
