"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { toast } from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import { getDb } from "@/lib/firebase";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import { useCachedFirebaseDoc } from "@/hooks/useCachedFirebaseDoc";
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";

import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import type { Album, Photo } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import ThemeToggle from "@/components/ThemeToggle";
import PhotoImage from "@/components/PhotoImage";
import SetCoverPhotoModal from "@/components/SetCoverPhotoModal";

export default function EditAlbumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;

  const [db, setDb] = useState<any>(null);
  const [albumData, setAlbumData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");

  // Load Firestore instance
  useEffect(() => {
    setDb(getDb());
  }, []);

  // Fetch album
  const albumDocRef = useMemo(
    () => (albumId && db ? doc(db, "albums", albumId) : null),
    [albumId, db]
  );
  const {
    data: album,
    loading: albumLoading,
    error: albumError,
    refetch: refetchAlbum,
  } = useCachedFirebaseDoc<Album>(albumDocRef, {
    cacheKey: `album_${albumId}`,
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime: true,
    staleWhileRevalidate: true,
  });

  // Fetch all photos for cover selection
  const photosQuery = useMemo(() => {
    if (!user || !db) return null;
    return query(collection(db, "photos"), orderBy("createdAt", "desc"));
  }, [user, db]);
  const {
    data: allPhotos,
    loading: isLoadingPhotos,
    error: photosError,
    refetch: refetchPhotos,
  } = useCachedFirebaseQuery<Photo>(photosQuery, {
    cacheKey: `user_photos_for_cover_${user?.uid || "none"}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: false,
    staleWhileRevalidate: true,
  });

  // Prefill form when album loads
  useEffect(() => {
    if (album) {
      setAlbumData({
        title: album.title || "",
        description: album.description || "",
        isPublic: !!album.isPublic,
      });
      setSelectedCoverPhoto(album.coverPhoto || "");
    }
  }, [album]);

  // Auth guard
  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
  }, [user, loading, router]);

  const canEdit = !!user && !!album && album.createdBy === user.uid;

  // Redirect if not allowed
  useEffect(() => {
    if (album && !canEdit) {
      toast.error("You don't have permission to edit this album");
      router.push(`/albums/${albumId}`);
    }
  }, [album, canEdit, albumId, router]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      setAlbumData((prev) => ({
        ...prev,
        [name]:
          type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
      }));
    },
    []
  );

  const handleRefreshPhotos = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("photos-refresh", user.uid);
      refetchPhotos();
    }
  }, [user, refetchPhotos]);

  const updateAlbum = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!db || !user || !album) {
        setError("You must be logged in to update an album");
        return;
      }
      if (!albumData.title.trim()) {
        setError("Album title is required");
        toast.error("Album title is required");
        return;
      }

      setIsUpdating(true);
      setError("");
      try {
        const ref = doc(db, "albums", albumId);
        await updateDoc(ref, {
          title: albumData.title.trim(),
          description: albumData.description.trim(),
          isPublic: albumData.isPublic,
          coverPhoto: selectedCoverPhoto || null,
          updatedAt: serverTimestamp(),
        });

        if (user) {
          CacheInvalidationManager.invalidateForAction(
            "album-update",
            user.uid
          );
          CacheInvalidationManager.invalidateAlbumPhotos(albumId);
        }
        toast.success("Album updated");
        refetchAlbum();
        router.push(`/albums/${albumId}`);
      } catch (err) {
        console.error("Error updating album:", err);
        setError("Failed to update album");
        toast.error("Failed to update album");
      } finally {
        setIsUpdating(false);
      }
    },
    [
      db,
      user,
      album,
      albumId,
      albumData,
      selectedCoverPhoto,
      router,
      refetchAlbum,
    ]
  );

  const deleteAlbum = useCallback(async () => {
    if (!db || !user || !album) return;

    setIsDeleting(true);
    try {
      const batch = writeBatch(db);

      // Remove album from any photos that reference it
      const photosInAlbumQ = query(
        collection(db, "photos"),
        where("albums", "array-contains", albumId)
      );
      const snap = await getDocs(photosInAlbumQ);
      snap.forEach((p) => {
        batch.update(doc(db, "photos", p.id), { albums: arrayRemove(albumId) });
      });

      batch.delete(doc(db, "albums", albumId));
      await batch.commit();

      CacheInvalidationManager.invalidateForAction("album-delete", user.uid);
      toast.success("Album deleted");
      router.push("/albums");
    } catch (err) {
      console.error("Error deleting album:", err);
      toast.error("Failed to delete album");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [db, user, album, albumId, router]);

  if (!db) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  if (loading || albumLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading album..." />
      </div>
    );
  }

  if (albumError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Error</h1>
          <p className="text-gray-600 dark:text-gray-300">
            Failed to load album.
          </p>
          <Link
            href="/albums"
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Back to Albums
          </Link>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Album Not Found</h1>
          <Link
            href="/albums"
            className="text-blue-600 hover:underline mt-4 inline-block"
          >
            Back to Albums
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <Link
              href={`/albums/${albumId}`}
              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
            >
              ← Back to Album
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Edit Album
          </h1>

          {error && (
            <div className="mb-6 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <form onSubmit={updateAlbum} className="space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Title
              </label>
              <input
                name="title"
                type="text"
                value={albumData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Album title"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                value={albumData.description}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="About this album (optional)"
              />
            </div>

            {/* Visibility */}
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                name="isPublic"
                checked={albumData.isPublic}
                onChange={handleInputChange}
                className="h-4 w-4"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Make album public
              </span>
            </label>

            {/* Cover Photo Section */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Cover Photo
                </h3>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRefreshPhotos}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Refresh photos
                  </button>
                  {selectedCoverPhoto && (
                    <button
                      type="button"
                      onClick={() => setSelectedCoverPhoto("")}
                      className="text-xs text-red-600 dark:text-red-400 hover:underline"
                    >
                      Remove cover
                    </button>
                  )}
                </div>
              </div>

              {selectedCoverPhoto ? (
                <div className="relative aspect-[3/2] w-full overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700">
                  <PhotoImage
                    src={selectedCoverPhoto}
                    alt="Selected cover"
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              ) : isLoadingPhotos ? (
                <div className="flex items-center justify-center h-40">
                  <LoadingSpinner message="Loading photos..." />
                </div>
              ) : photosError ? (
                <div className="text-sm text-red-600">
                  Failed to load photos.
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  No cover selected. Choose one from your photos.
                </div>
              )}

              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setShowCoverModal(true)}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {selectedCoverPhoto
                    ? "Change cover photo"
                    : "Choose cover photo"}
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:text-red-700"
                disabled={isDeleting}
              >
                Delete Album
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isUpdating ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </form>
        </div>

        {/* Simple delete confirm */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-md w-full">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Delete this album?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                This removes the album but keeps the photos.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 rounded border border-gray-300 dark:border-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={deleteAlbum}
                  className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cover Photo Modal */}
      <SetCoverPhotoModal
        album={album}
        photos={allPhotos || []}
        isOpen={showCoverModal}
        onClose={() => setShowCoverModal(false)}
        onPhotoSelected={(url) => {
          setSelectedCoverPhoto(url || "");
          setShowCoverModal(false);
        }}
      />
    </div>
  );
}

// Local modal state (after component to keep file tidy)
let showCoverModal = false;
function setShowCoverModal(v: boolean) {
  showCoverModal = v;
}
