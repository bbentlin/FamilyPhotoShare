"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import {
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  collection,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Album, Photo } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import PhotoImage from "@/components/PhotoImage";
import { toast } from "react-hot-toast";

// CACHING IMPORTS
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { useCachedFirebaseDoc } from "@/hooks/useCachedFirebaseDoc";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

export default function EditAlbumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;

  const [albumData, setAlbumData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // CACHED ALBUM DATA
  const albumDocRef = useMemo(
    () => (albumId ? doc(db, "albums", albumId) : null),
    [albumId]
  );

  const {
    data: album,
    loading: albumLoading,
    error: albumError,
    refetch: refetchAlbum,
    isStale: albumIsStale,
  } = useCachedFirebaseDoc<Album>(albumDocRef, {
    cacheKey: `album_${albumId}`,
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime: true,
    staleWhileRevalidate: true,
  });

  // CACHED PHOTOS QUERY for cover selection
  const photosQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, "photos"), orderBy("createdAt", "desc"));
  }, [user]);

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

  // CACHED ALBUM PHOTOS
  const albumPhotosQuery = useMemo(() => {
    if (!albumId) return null;
    return query(
      collection(db, "photos"),
      where("albums", "array-contains", albumId),
      orderBy("createdAt", "desc")
    );
  }, [albumId]);

  const {
    data: albumPhotos,
    loading: isLoadingAlbumPhotos,
    refetch: refetchAlbumPhotos,
  } = useCachedFirebaseQuery<Photo>(albumPhotosQuery, {
    cacheKey: `album_photos_${albumId}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: true,
    staleWhileRevalidate: true,
  });

  // Update form data when album loads
  useEffect(() => {
    if (album) {
      setAlbumData({
        title: album.title || "",
        description: album.description || "",
        isPublic: album.isPublic || false,
      });
      setSelectedCoverPhoto(album.coverPhoto || "");
    }
  }, [album]);

  // Redirect if not authenticated
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

  // Check if user can edit this album
  const canEdit = album && album.createdBy === user?.uid;

  // Redirect if not authorized
  useEffect(() => {
    if (album && !canEdit) {
      toast.error("You don't have permission to edit this album");
      router.push(`/albums/${albumId}`);
    }
  }, [album, canEdit, albumId, router]);

  // Handle input changes
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const checked =
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : undefined;

      setAlbumData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    },
    []
  );

  // Handle refresh functions
  const handleRefreshPhotos = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("photos-refresh", user.uid);
      refetchPhotos();
    }
  }, [user, refetchPhotos]);

  const handleRefreshAlbum = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("album-refresh", user.uid);
      refetchAlbum();
      refetchAlbumPhotos();
    }
  }, [user, refetchAlbum, refetchAlbumPhotos]);

  // Update album function
  const updateAlbum = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!user || !album) {
        setError("You must be logged in to update an album");
        return;
      }

      if (!albumData.title.trim()) {
        setError("Album title is required");
        return;
      }

      setIsUpdating(true);
      setError("");

      try {
        const albumRef = doc(db, "albums", albumId);
        await updateDoc(albumRef, {
          title: albumData.title.trim(),
          description: albumData.description.trim(),
          isPublic: albumData.isPublic,
          coverPhoto: selectedCoverPhoto || null,
          updatedAt: serverTimestamp(),
        });

        // INVALIDATE CACHE after successful update
        if (user) {
          CacheInvalidationManager.invalidateForAction(
            "album-update",
            user.uid
          );
        }

        toast.success(`Album "${albumData.title}" updated successfully!`);

        // Redirect back to album view
        router.push(`/albums/${albumId}`);
      } catch (error: unknown) {
        console.error("Error updating album:", error);
        setError("Failed to update album. Please try again.");
        toast.error("Failed to update album. Please try again.");
      } finally {
        setIsUpdating(false);
      }
    },
    [user, album, albumData, selectedCoverPhoto, albumId, router]
  );

  // Delete album function
  const deleteAlbum = useCallback(async () => {
    if (!user || !album) return;

    setIsDeleting(true);
    try {
      // Remove album reference from all photos in this album
      if (albumPhotos && albumPhotos.length > 0) {
        const updatePromises = albumPhotos.map(async (photo) => {
          const photoRef = doc(db, "photos", photo.id);
          const updatedAlbums =
            photo.albums?.filter((id) => id !== albumId) || [];
          await updateDoc(photoRef, {
            albums: updatedAlbums,
            updatedAt: serverTimestamp(),
          });
        });
        await Promise.all(updatePromises);
      }

      // Delete the album document
      const albumRef = doc(db, "albums", albumId);
      await deleteDoc(albumRef);

      // INVALIDATE CACHE after successful deletion
      if (user) {
        CacheInvalidationManager.invalidateForAction("album-delete", user.uid);
        CacheInvalidationManager.invalidateForAction("photo-update", user.uid);
      }

      toast.success(`Album "${album.title}" deleted successfully`);
      router.push("/albums");
    } catch (error: unknown) {
      console.error("Error deleting album:", error);
      toast.error("Failed to delete album. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  }, [user, album, albumPhotos, albumId, router]);

  // Loading state
  if (loading || albumLoading || isLoadingAlbumPhotos) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading album..." />
      </div>
    );
  }

  // Error states
  if (albumError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            Error loading album: {albumError}
          </p>
          <button
            onClick={handleRefreshAlbum}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Album not found
  if (!album) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Album Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-6">
            The album you're trying to edit doesn't exist or you don't have
            permission to edit it.
          </p>
          <Link
            href="/albums"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
            <div className="flex items-center space-x-4">
              <Link
                href={`/albums/${albumId}`}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                ← Back to Album
              </Link>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Edit Album
              {albumIsStale && (
                <span className="text-xs text-yellow-500 ml-2">
                  (updating...)
                </span>
              )}
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Update your album details and settings
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form onSubmit={updateAlbum} className="space-y-6">
            {/* Basic Album Info */}
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Album Title *
                </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={albumData.title}
                  onChange={handleInputChange}
                  required
                  disabled={isUpdating}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="Enter album title..."
                  maxLength={100}
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Description (Optional)
                </label>
                <textarea
                  id="description"
                  name="description"
                  value={albumData.description}
                  onChange={handleInputChange}
                  disabled={isUpdating}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                  placeholder="Describe your album..."
                  maxLength={500}
                />
              </div>
            </div>

            {/* Cover Photo Selection */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Cover Photo
              </h3>

              {photosError ? (
                <div className="text-center py-8 bg-red-50 dark:bg-red-900/20 rounded-lg border-2 border-dashed border-red-300 dark:border-red-800">
                  <svg
                    className="mx-auto h-12 w-12 text-red-400 dark:text-red-500 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <p className="text-red-600 dark:text-red-400 mb-2">
                    Error loading photos
                  </p>
                  <button
                    type="button"
                    onClick={handleRefreshPhotos}
                    className="text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
                  >
                    Try again
                  </button>
                </div>
              ) : isLoadingPhotos ? (
                <div className="flex items-center justify-center py-8">
                  <LoadingSpinner message="Loading photos..." />
                </div>
              ) : allPhotos && allPhotos.length > 0 ? (
                <>
                  {/* No Cover Option */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCoverPhoto("")}
                      disabled={isUpdating}
                      className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
                        selectedCoverPhoto === ""
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                      } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-center">
                        <svg
                          className="h-8 w-8 text-gray-400 dark:text-gray-500 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span
                          className={`font-medium ${
                            selectedCoverPhoto === ""
                              ? "text-blue-700 dark:text-blue-300"
                              : "text-gray-600 dark:text-gray-400"
                          }`}
                        >
                          No cover photo
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Photos Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded-lg p-3">
                    {allPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedCoverPhoto === photo.url
                            ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                            : "border-transparent hover:border-gray-300 dark:hover:border-gray-500"
                        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() =>
                          !isUpdating && setSelectedCoverPhoto(photo.url)
                        }
                      >
                        <PhotoImage
                          src={photo.url}
                          alt={photo.title || "Photo"}
                          className="w-full h-full object-cover"
                          fill={true}
                          sizes="(max-width: 640px) 25vw, 15vw"
                        />

                        {/* Selection indicator */}
                        {selectedCoverPhoto === photo.url && (
                          <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
                            <div className="bg-blue-600 text-white rounded-full p-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 bg-gray-50 dark:bg-gray-700 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 mb-2">
                    No photos available
                  </p>
                  <p className="text-sm text-gray-400 dark:text-gray-500">
                    Upload some photos first to select a cover
                  </p>
                  <Link
                    href="/upload"
                    className="inline-flex items-center mt-3 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    Upload Photos →
                  </Link>
                </div>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                Privacy Settings
              </h3>

              <div className="space-y-3">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={albumData.isPublic}
                    onChange={handleInputChange}
                    disabled={isUpdating}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 dark:border-gray-600 rounded disabled:opacity-50"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Make this album public
                    </span>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Public albums can be viewed by all family members. Private
                      albums are only visible to you unless shared.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Album Stats */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                Album Statistics
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {albumPhotos?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Photos
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {album.isPublic ? "Public" : "Private"}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Visibility
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {new Date(
                      typeof album.createdAt === "object" &&
                      album.createdAt &&
                      "toDate" in album.createdAt
                        ? (album.createdAt as any).toDate()
                        : album.createdAt
                    ).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Created
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {new Date(
                      typeof album.updatedAt === "object" &&
                      album.updatedAt &&
                      "toDate" in album.updatedAt
                        ? (album.updatedAt as any).toDate()
                        : album.updatedAt
                    ).toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Updated
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isUpdating || isDeleting}
                className="px-6 py-3 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium transition-colors disabled:opacity-50"
              >
                Delete Album
              </button>

              <div className="flex gap-3">
                <Link
                  href={`/albums/${albumId}`}
                  className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium transition-colors"
                >
                  Cancel
                </Link>

                <button
                  type="submit"
                  disabled={isUpdating || !albumData.title.trim()}
                  className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                    isUpdating || !albumData.title.trim()
                      ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isUpdating ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Updating...
                    </div>
                  ) : (
                    "Update Album"
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Album
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete "{album?.title}"? This action
              cannot be undone. Photos in this album will not be deleted, but
              they will be removed from the album.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={deleteAlbum}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isDeleting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </div>
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
