"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { notifyCommentOwner } from "@/lib/notifications";
import { toast } from "react-toastify";

interface Comment {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: any;
  photoId: string;
}

interface CommentsProps {
  photoId: string;
  photoOwnerId: string;
  photoOwnerName: string;
}

export default function Comments({
  photoId,
  photoOwnerId,
  photoOwnerName,
}: CommentsProps) {
  const { user } = useAuth();
  const { canWrite } = useDemo(); 
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [db, setDb] = useState<any>(null);

  useEffect(() => {
    setDb(getDb());
  }, []);

  useEffect(() => {
    if (!photoId || !db) return;

    const fetchComments = async () => {
      try {
        const commentsQuery = query(
          collection(db, "comments"),
          where("photoId", "==", photoId),
          orderBy("createdAt", "asc")
        );

        const snapshot = await getDocs(commentsQuery);
        const commentsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Comment[];
        setComments(commentsData);
      } catch (error: any) {
        console.error("Error fetching comments:", error);
        if (error.code === "permission-denied") {
          console.warn(
            "Permission denied for comments - user may not have access"
          );
          setComments([]);
        }
      }
    };

    fetchComments();
  }, [photoId, db]);

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();

    // Block demo users
    if (!canWrite) {
      toast.error("Demo mode: Adding comments is disabled");
      return;
    }

    if (!user || !newComment.trim() || !db) return;

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "comments"), {
        text: newComment.trim(),
        authorId: user.uid,
        authorName: user.displayName || user.email || "Anonymous",
        photoId: photoId,
        createdAt: serverTimestamp(),
      });

      // Send notification if comment is not by photo owner
      if (user.uid !== photoOwnerId) {
        notifyCommentOwner({
          ownerId: photoOwnerId,
          ownerEmail: undefined, // optional
          commenterName: user.displayName || user.email || "Someone",
          photoTitle: "Photo",
          photoUrl: typeof window !== "undefined" ? window.location.href : "",
        });
      }

      setNewComment("");

      // Manually refresh comments after adding
      const commentsQuery = query(
        collection(db, "comments"),
        where("photoId", "==", photoId),
        orderBy("createdAt", "asc")
      );
      const snapshot = await getDocs(commentsQuery);
      const commentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      setComments(commentsData);
    } catch (error) {
      console.error("Error adding comment:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!db) {
    return <div>Comments unavailable</div>;
  }

  return (
    <div className="mt-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Comments ({comments.length})
      </h3>

      {/* Comment Form */}
      {user && (
        <form onSubmit={handleSubmitComment} className="mb-4">
          <div className="flex gap-3">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={
                canWrite ? "Add a comment..." : "Comments disabled in demo mode"
              }
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              disabled={isSubmitting || !canWrite} 
            />
            <button
              type="submit"
              disabled={isSubmitting || !newComment.trim() || !canWrite} 
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </button>
          </div>
        </form>
      )}

      {/* Comments List */}
      <div className="space-y-3">
        {comments.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No Comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((comment) => (
            <div
              key={comment.id}
              className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 dark:text-white text-sm">
                      {comment.authorName}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {comment.createdAt?.toDate?.()?.toLocaleString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }) || "Just now"}
                    </span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 text-sm">
                    {comment.text}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
