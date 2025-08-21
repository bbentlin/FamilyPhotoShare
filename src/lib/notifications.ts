import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from "firebase/firestore";
import { db } from "./firebase";

// Firestore document shape for in-app notifications
export type InAppNotification = {
  userId: string;
  type: "comment" | "new_upload";
  title: string;
  message: string;
  url?: string;
  photoId?: string;
  albumId?: string;
  actorId?: string; // who triggered it
  actorName?: string; // denormalized name for fast rendering (optional)
  read: boolean;
  createdAt: Timestamp | null;
};

// Create one in-app notification (server timestamp + unread by default)
export async function createInAppNotification(
  input: Omit<InAppNotification, "read" | "createdAt">
) {
  try {
    await addDoc(collection(db, "notifications"), {
      ...input,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.warn("[notify] createInAppNotification failed:", e);
  }
}

// Email sending helper (calls your Next.js API route)
type SendEmailInput = {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
};

export async function sendEmailNotification(input: SendEmailInput) {
  try {
    const res = await fetch("/api/notifications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn("[notify] email send failed:", e);
    return null;
  }
}

// Notify the photo owner about a new comment (email if prefs allow) and create an in-app notification
export async function notifyCommentOwner(params: {
  photoOwnerId: string;
  commenterName: string;
  commentText: string;
  photoTitle?: string;
  photoUrl?: string;
  photoId?: string;
  actorId?: string;
}) {
  const {
    photoOwnerId,
    commenterName,
    commentText,
    photoTitle,
    photoUrl,
    photoId,
    actorId,
  } = params;

  // Don't notify the actor about their own action
  if (actorId && actorId === photoOwnerId) return;

  try {
    const ownerSnap = await getDoc(doc(db, "users", photoOwnerId));
    if (!ownerSnap.exists()) return;

    const owner = ownerSnap.data() as any;
    const toEmail: string | undefined =
      owner.email || owner.emailAddress || undefined;

    const emailNotifications: boolean =
      owner.emailNotifications ?? true; // default opt-in
    const commentsNotification: boolean =
      owner.commentsNotification ?? true; // default opt-in

    // Best-effort email (if owner allows and we have an email)
    if (emailNotifications && commentsNotification && toEmail) {
      const subject = `New comment on your photo${
        photoTitle ? `: ${photoTitle}` : ""
      }`;
      const html = `
        <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
          <p><strong>${escapeHtml(
            commenterName
          )}</strong> commented on your photo${
        photoTitle ? ` <strong>${escapeHtml(photoTitle)}</strong>` : ""
      }.</p>
          <blockquote style="margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#444">
            ${escapeHtml(commentText)}
          </blockquote>
          ${
            photoUrl
              ? `<p><a href="${photoUrl}" style="color:#2563eb">View photo</a></p>`
              : ""
          }
          <p style="color:#6b7280;font-size:12px">You can change email preferences in Settings.</p>
        </div>
      `;
      await sendEmailNotification({ to: toEmail, subject, html });
    }

    // In-app notification for the owner (always best-effort)
    await createInAppNotification({
      userId: photoOwnerId,
      type: "comment",
      title: "New comment on your photo",
      message: `${commenterName} commented: "${commentText}"`,
      url: photoUrl,
      photoId,
      actorId,
      actorName: commenterName,
    });
  } catch (e) {
    console.warn("[notify] notifyCommentOwner failed:", e);
  }
}

// Notify opted-in users about a new upload (emails + in-app)
// Excludes the uploader themselves.
export async function notifyNewUploadSubscribers(params: {
  uploaderId: string;
  uploaderName: string;
  photoTitle?: string;
  photoUrl?: string;
  photoId?: string;
}) {
  const { uploaderId, uploaderName, photoTitle, photoUrl, photoId } = params;

  try {
    // Find recipients who opted in
    const q = query(
      collection(db, "users"),
      where("emailNotifications", "==", true),
      where("newUploadsNotification", "==", true)
    );
    const snap = await getDocs(q);

    const recipients: Array<{ uid: string; email?: string }> = [];
    snap.forEach((d) => {
      if (d.id === uploaderId) return;
      const u = d.data() as any;
      recipients.push({ uid: d.id, email: u.email || u.emailAddress });
    });

    if (recipients.length === 0) return;

    const subject = `${uploaderName} uploaded a new photo${
      photoTitle ? `: ${photoTitle}` : ""
    }`;
    const html = `
      <div style="font-family:system-ui,Segoe UI,Roboto,Arial,sans-serif">
        <p><strong>${escapeHtml(
          uploaderName
        )}</strong> uploaded a new photo${
      photoTitle ? ` <strong>${escapeHtml(photoTitle)}</strong>` : ""
    }.</p>
        ${
          photoUrl
            ? `<p><a href="${photoUrl}" style="color:#2563eb">View photo</a></p>`
            : ""
        }
        <p style="color:#6b7280;font-size:12px">Manage notifications in Settings.</p>
      </div>
    `;

    // Send emails individually (avoid exposing addresses)
    await Promise.all(
      recipients
        .filter((r) => !!r.email)
        .map((r) =>
          sendEmailNotification({
            to: r.email as string,
            subject,
            html,
          })
        )
    );

    // Create in-app notifications
    await Promise.all(
      recipients.map((r) =>
        createInAppNotification({
          userId: r.uid,
          type: "new_upload",
          title: "New photo uploaded",
          message: `${uploaderName} uploaded ${photoTitle || "a new photo"}`,
          url: photoUrl,
          photoId,
          actorId: uploaderId,
          actorName: uploaderName,
        })
      )
    );
  } catch (e) {
    console.warn("[notify] notifyNewUploadSubscribers failed:", e);
  }
}

// Utilities
function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#039;";
      default:
        return c;
    }
  });
