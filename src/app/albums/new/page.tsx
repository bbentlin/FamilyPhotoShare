"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Album } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import PhotoImage from "@/components/PhotoImage";
import { toast } from "react-hot-toast";

// CACHING IMPORTS
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

const db = getDb();

export default function NewAlbumPage() {
  if (!db) {
    return <div>Database not available</div>;
  }
  const { user, loading } = useAuth();
  const router = useRouter();
  const [albumData, setAlbumData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Cover photo selection states
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState("");
  const [isMounted, setIsMounted] = useState(false);

  // CACHED PHOTOS QUERY for cover selection
  const photosQuery = useMemo(() => {
    if (!user) return null;
    return query(collection(db, "photos"), orderBy("createdAt", "desc"));
  }, [user]);

  const {
    data: photos,
    loading: isLoadingPhotos,
    error: photosError,
    refetch: refetchPhotos,
  } = useCachedFirebaseQuery(photosQuery, {
    cacheKey: `user_photos_for_cover_${user?.uid || "none"}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: false, // No real-time needed for cover selection
    staleWhileRevalidate: true,
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push("/login");
      return;
    }
  }, [user, loading, router]);

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

  // Handle refresh if photos fail to load
  const handleRefreshPhotos = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("photos-refresh", user.uid);
      refetchPhotos();
    }
  }, [user, refetchPhotos]);

  // Create album function
  const createAlbum = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!user) {
        setError("You must be logged in to create an album");
        return;
      }

      if (!albumData.title.trim()) {
        setError("Album title is required");
        return;
      }

      setIsCreating(true);
      setError("");

      try {
        const albumDoc = await addDoc(collection(db, "albums"), {
          title: albumData.title.trim(),
          description: albumData.description.trim(),
          isPublic: albumData.isPublic,
          createdBy: user.uid,
          createdByName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          photos: [],
          photoCount: 0,
          coverPhoto: selectedCoverPhoto || null,
          sharedWith: [],
          tags: [],
        });

        // INVALIDATE CACHE after successful album creation
        if (user) {
          CacheInvalidationManager.invalidateForAction(
            "album-create",
            user.uid
          );
        }

        toast.success(`Album "${albumData.title}" created successfully!`);

        // Redirect to the new album
        router.push(`/albums/${albumDoc.id}`);
      } catch (error: unknown) {
        console.error("Error creating album:", error);
        setError("Failed to create album. Please try again.");
        toast.error("Failed to create album. Please try again.");
      } finally {
        setIsCreating(false);
      }
    },
    [user, albumData, selectedCoverPhoto, router]
  );

  if (!isMounted) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/albums"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                ← Back to Albums
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
              Create New Album
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Organize your photos into a beautiful album
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
              <span className="block sm:inline">{error}</span>
            </div>
          )}

          <form onSubmit={createAlbum} className="space-y-6">
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
                  disabled={isCreating}
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
                  disabled={isCreating}
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
                Cover Photo (Optional)
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
              ) : photos && photos.length > 0 ? (
                <>
                  {/* No Cover Option */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCoverPhoto("")}
                      disabled={isCreating}
                      className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
                        selectedCoverPhoto === ""
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
                      } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
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
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedCoverPhoto === photo.url
                            ? "border-blue-500 ring-2 ring-blue-200 dark:ring-blue-800"
                            : "border-transparent hover:border-gray-300 dark:hover:border-gray-500"
                        } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() =>
                          !isCreating && setSelectedCoverPhoto(photo.url)
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
                    disabled={isCreating}
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

            {/* Album Preview */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-6 bg-gray-50 dark:bg-gray-700">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                Album Preview
              </h3>

              <div className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="w-16 h-16 rounded-lg bg-gray-200 dark:bg-gray-600 flex items-center justify-center mr-4 overflow-hidden">
                  {selectedCoverPhoto ? (
                    <PhotoImage
                      src={selectedCoverPhoto}
                      alt={"Cover preview"}
                      className="w-16 h-16 object-cover rounded-lg"
                      width={64}
                      height={64}
                      sizes="64px"
                    />
                  ) : (
                    <svg
                      className="h-8 w-8 text-gray-400 dark:text-gray-500"
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
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                    {albumData.title || "Untitled Album"}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {albumData.description ||
                      "Album description will appear here"}
                  </p>
                  <div className="flex items-center mt-2 text-xs text-gray-400 dark:text-gray-500">
                    <span>0 photos</span>
                    <span className="mx-2">•</span>
                    <span>{albumData.isPublic ? "Public" : "Private"}</span>
                    <span className="mx-2">•</span>
                    <span>Created by {user?.displayName || user?.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6">
              <Link
                href="/albums"
                className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isCreating || !albumData.title.trim()}
                className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                  isCreating || !albumData.title.trim()
                    ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isCreating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  "Create Album"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Next Steps Info */}
        <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
          <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300 mb-2">
            What happens next?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>
              • Your album will be created and you'll be taken to the album page
            </li>
            <li>
              • You can add photos by uploading them or selecting them from
              existing photos
            </li>
            <li>• You can share the album with family members</li>
            <li>• You can edit the album details anytime</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
