import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type AppNotification = {
  userId: string;
  type: "upload" | "comment" | "album";
  title: string;
  body?: string;
  url?: string // where to navigate
  read?: boolean;
  createdAt?: any;
};

export async function createNotification(n: AppNotification) {
  await addDoc(collection(db, "notifications"), {
    ...n,
    read: n.read ?? false,
    createdAt: serverTimestamp(),
  });
}

// Email helper
export async function sendEmailNotification(payload: {
  to: string | string[];
  subject: string;
  html?: string;
  message?: string;
  type?: string;
}) {
  try {
    await fetch("/api/notifications/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // ignore email failures for now  
  }
}

// Notify all family members except the actor (best effort)
export async function notifyNewUploadSubscribers(args: {
  uploaderId: string;
  uploaderName: string;
  photoTitle: string;
  photoUrl: string; // app route like /photos/{id}
  photoId: string;
}) {
  try {
    // Find recipients (signed-up family members)
    const usersQ = query(
      collection(db, "users"),
      where("uid", "!=", args.uploaderId)
    );
    const snap = await getDocs(usersQ);

    const title = `${args.uploaderName} uploaded "${args.photoTitle}"`;
    const html = `<p><strong>${args.uploaderName}</strong> uploaded “${args.photoTitle}”.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${args.photoUrl}">View photo</a></p>`;

    const emails: string[] = [];
    await Promise.all(
      snap.docs.map(async (d) => {
        const u = d.data() as any;
        const userId = u.uid || d.id;
        // Create in-app notification
        await createNotification({
          userId,
          type: "upload",
          title,
          body: "",
          url: args.photoUrl,
        });
        if (u.email && u.emailNotifications?.uploads !== false) {
          emails.push(u.email);
        }
      })
    );

    if (emails.length) {
      await sendEmailNotification({
        to: emails,
        subject: title,
        html,
        type: "upload",
      });
    }
  } catch (e) {
    // best effort only
    console.warn("notifyNewUploadSubscribers failed", e);
  }
}

export async function notifyCommentOwner(args: {
  ownerId: string;
  ownerEmail?: string;
  commenterName: string;
  photoTitle: string;
  photoUrl: string;
}) {
  const title = `${args.commenterName} commented on "${args.photoTitle}"`;
  await createNotification({
    userId: args.ownerId,
    type: "comment",
    title,
    url: args.photoUrl,
  });
  if (args.ownerEmail) {
    await sendEmailNotification({
      to: args.ownerEmail,
      subject: title,
      html: `<p><strong>${args.commenterName}</strong> commented on “${args.photoTitle}”.</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL ?? ""}${args.photoUrl}">Open photo</a></p>`,
      type: "comment",
    });
  }
}