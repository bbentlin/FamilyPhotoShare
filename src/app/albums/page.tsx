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
  updateDoc, // Just import it normally
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
  const [albums, setAlbums] = useState<Album[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [db, setDb] = useState<any>(null);

  useEffect(() => {
    setDb(getDb());
  }, []);

  // USE CACHED ALBUMS HOOK
  const {
    data: cachedAlbums,
    loading: isLoading,
    error,
    refetch,
    isStale,
  } = useCachedAlbums(true); // Enable realtime updates

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch albums from the database
  useEffect(() => {
    const fetchAlbums = async () => {
      if (!user || !db) {
        setDbLoading(false);
        return;
      }

      setDbLoading(true);

      try {
        const { collection, query, orderBy, getDocs } = await import(
          "firebase/firestore"
        );
        const albumsQuery = query(
          collection(db, "albums"),
          where("createdBy", "==", user.uid),
          orderBy("updatedAt", "desc")
        );
        const albumsSnapshot = await getDocs(albumsQuery);

        const fetchedAlbums = albumsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Album[];

        setAlbums(fetchedAlbums);
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setDbLoading(false);
      }
    };

    fetchAlbums();
  }, [user, db]);

  // Delete album function
  const handleDeleteAlbum = useCallback(
    async (album: Album) => {
      if (!user || !album.id) return;

      setDeletingAlbumId(album.id);

      try {
        // Check if user can delete this album (owner or admin)
        if (album.createdBy !== user.uid) {
          toast.error("You can only delete albums you created");
          return;
        }

        // Delete the album document
        await deleteDoc(doc(db, "albums", album.id));

        // Remove album reference from photos (if your data structure uses this)
        const photosQuery = query(
          collection(db, "photos"),
          where("albumId", "==", album.id)
        );
        const photosSnapshot = await getDocs(photosQuery);

        const updatePromises = photosSnapshot.docs.map((photoDoc) =>
          updateDoc(doc(db, "photos", photoDoc.id), {
            albumId: null, // or you could use deleteField() to remove the field entirely
          })
        );

        await Promise.all(updatePromises);

        // INVALIDATE CACHE
        CacheInvalidationManager.invalidateForAction("album-delete", user.uid);

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
  if (loading || dbLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading albums..." />
      </div>
    );
  }

  if (!db) {
    return <div>Database not available</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Photo Albums
            {isStale && (
              <span className="text-xs text-yellow-500 ml-2">
                (updating...)
              </span>
            )}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Organize your family photos into beautiful albums
          </p>
        </div>

        {albums.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums.map((album, index) => (
              <div
                key={album.id}
                className="rounded-xl overflow-hidden bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
              >
                <div className="relative aspect-square min-h-[200px] bg-gray-100 dark:bg-gray-700">
                  {album.coverPhoto && (
                    <PhotoImage
                      src={album.coverPhoto}
                      alt={album.title}
                      className="w-full h-full object-cover"
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      priority={index < 6} // <-- first row of cards eager
                    />
                  )}
                </div>

                {/* Album Info */}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <Link href={`/albums/${album.id}`}>
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate mb-1 hover:text-blue-600 dark:hover:text-blue-400">
                          {album.title}
                        </h3>
                      </Link>
                      {album.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                          {album.description}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        Updated{" "}
                        {new Date(
                          typeof album.updatedAt === "object" &&
                          album.updatedAt &&
                          "toDate" in album.updatedAt
                            ? (album.updatedAt as any).toDate()
                            : album.updatedAt
                        ).toLocaleDateString()}
                      </p>
                    </div>

                    {/* Delete Button - Only show if user created the album */}
                    {album.createdBy === user?.uid && (
                      <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            confirmDeleteAlbum(album);
                          }}
                          disabled={deletingAlbumId === album.id}
                          className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                          title="Delete album"
                        >
                          {deletingAlbumId === album.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <svg
                              className="h-4 w-4"
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
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 max-w-md mx-auto">
              <svg
                className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No albums yet
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Create your first album to organize your family photos
              </p>
              <Link
                href="/albums/new"
                className="inline-flex items-center px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Create Your First Album
              </Link>
            </div>
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
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Delete Album
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-gray-700 dark:text-gray-300">
                Are you sure you want to delete{" "}
                <strong>"{albumToDelete.title}"</strong>? This will remove the
                album but not the photos themselves.
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAlbum(albumToDelete)}
                disabled={deletingAlbumId === albumToDelete.id}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 flex items-center"
              >
                {deletingAlbumId === albumToDelete.id ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  "Delete Album"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
