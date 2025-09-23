"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";

import { getDb } from "@/lib/firebase";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";

import {
  collection,
  orderBy,
  query,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";

import ThemeToggle from "@/components/ThemeToggle";
import LoadingSpinner from "@/components/LoadingSpinner";
import PhotoImage from "@/components/PhotoImage";
import type { Photo } from "@/types";

export default function NewAlbumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // State
  const [db, setDb] = useState<any>(null);
  const [albumData, setAlbumData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState<string>(""); // stores photo.url
  const [isMounted, setIsMounted] = useState(false);

  // Init db and mount flags
  useEffect(() => {
    setDb(getDb());
    setIsMounted(true);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (loading) return;
    if (!user) router.push("/login");
  }, [user, loading, router]);

  // Load recent photos for cover selection
  const photosQuery = useMemo(() => {
    if (!user || !db) return null;
    return query(collection(db, "photos"), orderBy("createdAt", "desc"));
  }, [user, db]);

  const {
    data: photos,
    loading: isLoadingPhotos,
    error: photosError,
    refetch: refetchPhotos,
  } = useCachedFirebaseQuery<Photo>(photosQuery, {
    cacheKey: `user_photos_for_cover_${user?.uid || "none"}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: false,
    staleWhileRevalidate: true,
  });

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value, type } = e.target;
      const checked =
        type === "checkbox"
          ? (e.target as HTMLInputElement).checked
          : undefined;

      setAlbumData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? !!checked : value,
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

  const createAlbum = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!user) {
        setError("You must be logged in to create an album");
        return;
      }
      if (!albumData.title.trim()) {
        setError("Album title is required");
        toast.error("Album title is required");
        return;
      }

      setIsCreating(true);
      setError("");

      try {
        const docRef = await addDoc(collection(db, "albums"), {
          title: albumData.title.trim(),
          description: albumData.description.trim(),
          isPublic: albumData.isPublic,
          createdBy: user.uid,
          createdByName: user.displayName || user.email || "Unknown",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          photos: [],
          photoCount: 0,
          coverPhoto: selectedCoverPhoto || null, // store cover URL or null
          sharedWith: [],
          tags: [],
        });

        if (user) {
          CacheInvalidationManager.invalidateForAction(
            "album-create",
            user.uid
          );
        }

        toast.success(`Album "${albumData.title}" created`);
        router.push(`/albums/${docRef.id}`);
      } catch (err) {
        console.error("Error creating album:", err);
        setError("Failed to create album. Please try again.");
        toast.error("Failed to create album");
      } finally {
        setIsCreating(false);
      }
    },
    [user, albumData, selectedCoverPhoto, db, router]
  );

  if (!isMounted) return <LoadingSpinner message="Loading..." />;

  if (!db) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Database Error
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Firestore is not available.
          </p>
          <Link
            href="/albums"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Description
                </label>
                <textarea
                  name="description"
                  value={albumData.description}
                  onChange={handleInputChange}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Tell something about this album (optional)"
                />
              </div>
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
            </div>

            {/* Cover Photo */}
            <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                  Cover Photo
                </h3>
                <div className="flex items-center gap-2">
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
              ) : photos && photos.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {photos.slice(0, 20).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="relative aspect-square rounded-md overflow-hidden bg-gray-100 dark:bg-gray-700 hover:ring-2 hover:ring-blue-500"
                      onClick={() => setSelectedCoverPhoto(p.url)}
                      title={p.title || "Photo"}
                    >
                      <PhotoImage
                        src={p.url}
                        alt={p.title || "Photo"}
                        fill
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  You have no photos yet. Upload some first, or create the album
                  without a cover and set it later.
                </div>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Tip: You can change the cover photo later from the album page.
              </p>
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end pt-4">
              <button
                type="submit"
                disabled={isCreating}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating ? "Creating…" : "Create Album"}
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
            <li>• You’ll be taken to the new album</li>
            <li>• Add photos by uploading them or selecting from existing</li>
            <li>• Change the cover photo anytime</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
