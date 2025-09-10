"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {
  doc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  writeBatch, 
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { Album } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import PhotoImage from "@/components/PhotoImage";
import { toast } from "react-hot-toast";

// CACHING IMPORTS
import { useCachedAlbums } from "@/hooks/useCachedAlbums";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

export default function AlbumsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [albumToDelete, setAlbumToDelete] = useState<Album | null>(null);

  // USE CACHED ALBUMS HOOK
  const {
    albums: cachedAlbums, // RENAME TO cachedAlbums to avoid conflict
    loading: isLoading,
    error,
    refetch,
    isStale,
  } = useCachedAlbums(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Handle album deletion
  const handleDeleteAlbum = useCallback(
    async (album: Album) => {
      if (!user || !album) return;

      setDeletingAlbumId(album.id);
      try {
        const db = getDb(); 
        const batch = writeBatch(db);

        // Find all photos that are in this album
        const photosQuery = query(
          collection(db, "photos"),
          where("albums", "array-contains", album.id)
        );
        const photosSnapshot = await getDocs(photosQuery);

        // For each photo, remove the album from its 'albums' array
        photosSnapshot.forEach((photoDoc) => {
          const photoRef = doc(db, "photos", photoDoc.id);
          const photoData = photoDoc.data();
          const updatedAlbums =
            photoData.albums?.filter((id: string) => id !== album.id) || [];
          batch.update(photoRef, { albums: updatedAlbums });
        });

        // Delete the album document itself
        const albumRef = doc(db, "albums", album.id);
        batch.delete(albumRef);

        // Commit all the batched writes at once
        await batch.commit();

        // INVALIDATE CACHE
        CacheInvalidationManager.invalidateForAction("album-delete", user.uid);
        CacheInvalidationManager.invalidateForAction("photo-update", user.uid); // Invalidate photos too

        // Refetch to update UI immediately
        refetch();

        toast.success(`Album "${album.title}" deleted successfully`);
        setShowDeleteModal(false);
        setAlbumToDelete(null);
      } catch (error) {
        console.error("Error deleting album:", error);
        toast.error("Failed to delete album. Please try again.");
      } finally {
        setDeletingAlbumId(null);
      }
    },
    [user, refetch]
  );

  // Show delete confirmation modal
  const confirmDeleteAlbum = (album: Album) => {
    setAlbumToDelete(album);
    setShowDeleteModal(true);
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setAlbumToDelete(null);
  };

  // Loading screen
  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading albums..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              My Albums
            </h1>
            <Link
              href="/albums/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Create Album
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isStale && (
          <div className="mb-4 text-center text-sm text-yellow-600 dark:text-yellow-400">
            Updating albums...
          </div>
        )}

        {cachedAlbums && cachedAlbums.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {cachedAlbums.map((album) => (
              <div
                key={album.id}
                className="group relative bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700 transition-all hover:shadow-lg hover:-translate-y-1"
              >
                <Link href={`/albums/${album.id}`} className="block">
                  <div className="aspect-square w-full relative">
                    {album.coverPhoto ? (
                      <PhotoImage
                        src={album.coverPhoto}
                        alt={album.title}
                        className="object-cover"
                        fill
                        priority
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                        <svg
                          className="w-12 h-12 text-gray-300 dark:text-gray-500"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="absolute bottom-0 left-0 p-4">
                    <h3 className="text-white font-bold text-lg truncate">
                      {album.title}
                    </h3>
                    <p className="text-gray-200 text-sm">
                      {album.photoCount || 0} photos
                    </p>
                  </div>
                </Link>
                <div className="absolute top-2 right-2 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Link
                    href={`/albums/${album.id}/edit`}
                    className="p-2 bg-white/80 dark:bg-gray-900/80 rounded-full text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z"
                      />
                    </svg>
                  </Link>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      confirmDeleteAlbum(album);
                    }}
                    disabled={deletingAlbumId === album.id}
                    className="p-2 bg-red-500/80 rounded-full text-white hover:bg-red-500 disabled:bg-gray-400"
                  >
                    {deletingAlbumId === album.id ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              No albums yet
            </h2>
            <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">
              Create your first album to start organizing photos.
            </p>
            <Link
              href="/albums/new"
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Album
            </Link>
          </div>
        )}

        {error && (
          <div className="mt-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">
              Error loading albums: {error}
            </span>
            <button
              onClick={() => refetch()}
              className="ml-4 underline hover:no-underline"
            >
              Try again
            </button>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && albumToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="ml-4 text-lg font-medium text-gray-900 dark:text-white">
                Delete Album
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to delete the album "
              <strong>{albumToDelete.title}</strong>"? This will not delete the
              photos, but it will remove them from this album. This action
              cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAlbum(albumToDelete)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
