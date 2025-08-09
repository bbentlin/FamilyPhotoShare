"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "next/navigation";
import { doc, collection, query, where, orderBy } from "firebase/firestore";
import { db, getDb } from "@/lib/firebase";
import { Album, Photo } from "@/types";
import Link from "next/link";
import PhotoImage from "@/components/PhotoImage";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "react-hot-toast";

// CACHING IMPORTS
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { useCachedFirebaseDoc } from "@/hooks/useCachedFirebaseDoc";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

export default function AlbumPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;

  // State
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);

  const db = getDb();

  // CACHED ALBUM DATA
  const albumDocRef = useMemo(
    () => (albumId ? doc(db, "albums", albumId) : null),
    [albumId]
  );

  const {
    data: cachedAlbum,
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

  // CACHED ALBUM PHOTOS
  const photosQuery = useMemo(() => {
    if (!albumId) return null;
    return query(
      collection(db, "photos"),
      where("albums", "array-contains", albumId),
      orderBy("createdAt", "desc")
    );
  }, [albumId]);

  const {
    data: cachedPhotos,
    loading: photosLoading,
    error: photosError,
    refetch: refetchPhotos,
    isStale: photosIsStale,
  } = useCachedFirebaseQuery<Photo>(photosQuery, {
    cacheKey: `album_photos_${albumId}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: true,
    staleWhileRevalidate: true,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("album-refresh", user.uid);
      refetchAlbum();
      refetchPhotos();
      toast.success("Album refreshed!");
    }
  }, [user, refetchAlbum, refetchPhotos]);

  // Photo modal functions
  const openPhotoModal = useCallback((photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  }, []);

  const closePhotoModal = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  const goToPreviousPhoto = useCallback(() => {
    if (selectedPhotoIndex > 0 && photos) {
      const newIndex = selectedPhotoIndex - 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  }, [selectedPhotoIndex, photos]);

  const goToNextPhoto = useCallback(() => {
    if (photos && selectedPhotoIndex < photos.length - 1) {
      const newIndex = selectedPhotoIndex + 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  }, [selectedPhotoIndex, photos]);

  // Fetch album data from Firestore
  useEffect(() => {
    if (!db) return;

    const fetchAlbumData = async () => {
      try {
        const { doc, getDoc, collection, query, where, getDocs } = await import(
          "firebase/firestore"
        );

        // Fetch album details
        const albumDoc = doc(db, "albums", albumId);
        const albumSnapshot = await getDoc(albumDoc);

        if (albumSnapshot.exists()) {
          const albumData = {
            id: albumSnapshot.id,
            ...albumSnapshot.data(),
          } as Album;
          setAlbum(albumData);

          // Fetch photos for the album
          const photosQuery = query(
            collection(db, "photos"),
            where("albums", "array-contains", albumId),
            orderBy("createdAt", "desc")
          );
          const photosSnapshot = await getDocs(photosQuery);
          const photosData = photosSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Photo[];
          setPhotos(photosData);
        } else {
          setAlbum(null);
        }
      } catch (error) {
        console.error("Error fetching album:", error);
      }
    };

    fetchAlbumData();
  }, [albumId, db]);

  if (!db) {
    return <div>Database not available</div>;
  }

  // Loading state
  if (loading || albumLoading || photosLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading album..." />
      </div>
    );
  }

  // Error states
  if (albumError || photosError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">
            Error loading album: {albumError || photosError}
          </p>
          <button
            onClick={handleRefresh}
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
            The album you're looking for doesn't exist or you don't have
            permission to view it.
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
                href="/albums"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                ← Back to Albums
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Refresh album"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>

              {/* Edit button - only show if user created the album */}
              {album.createdBy === user?.uid && (
                <Link
                  href={`/albums/${albumId}/edit`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <svg
                    className="h-4 w-4 mr-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Edit Album
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Album Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                {album.title}
                {(albumIsStale || photosIsStale) && (
                  <span className="text-xs text-yellow-500 ml-2">
                    (updating...)
                  </span>
                )}
              </h1>
              {album.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {album.description}
                </p>
              )}
              <div className="flex items-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
                <span>{photos?.length || 0} photos</span>
                <span>
                  Created{" "}
                  {new Date(
                    typeof album.createdAt === "object" &&
                    album.createdAt &&
                    "toDate" in album.createdAt
                      ? (album.createdAt as any).toDate()
                      : album.createdAt
                  ).toLocaleDateString()}
                </span>
                <span>By {album.createdByName || "Unknown"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Photos Grid */}
        {photos && photos.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {photos.map((photo, index) => (
              <div
                key={photo.id}
                className="group relative aspect-square min-h-[200px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
                onClick={() => openPhotoModal(photo, index)}
              >
                <PhotoImage
                  src={photo.url}
                  alt={photo.title || "Photo"}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  fill={true}
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                />

                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />

                {/* Photo info overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-sm font-medium truncate">
                    {photo.title || "Untitled Photo"}
                  </p>
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
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                No photos in this album
              </h3>
              <p className="text-gray-600 dark:text-gray-300 mb-6">
                Add some photos to bring this album to life
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/photos"
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  <svg
                    className="h-4 w-4 mr-2"
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
                  Add from Photos
                </Link>
                <Link
                  href="/upload"
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                >
                  <svg
                    className="h-4 w-4 mr-2"
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
                  Upload New Photos
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Photo Modal - You'll need to create this component or use an existing one */}
      {selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4">
          <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center">
            {/* Close button */}
            <button
              onClick={closePhotoModal}
              className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-colors"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {/* Previous button */}
            {selectedPhotoIndex > 0 && (
              <button
                onClick={goToPreviousPhoto}
                className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {/* Next button */}
            {photos && selectedPhotoIndex < photos.length - 1 && (
              <button
                onClick={goToNextPhoto}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-colors"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            {/* Photo */}
            <div className="relative max-w-full max-h-full">
              <PhotoImage
                src={selectedPhoto.url}
                alt={selectedPhoto.title || "Photo"}
                className="max-w-full max-h-full object-contain"
                width={1200}
                height={800}
                sizes="100vw"
              />

              {/* Photo info */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <h3 className="text-white text-xl font-semibold mb-2">
                  {selectedPhoto.title || "Untitled Photo"}
                </h3>
                {selectedPhoto.description && (
                  <p className="text-gray-200 text-sm">
                    {selectedPhoto.description}
                  </p>
                )}
                <p className="text-gray-300 text-xs mt-2">
                  {selectedPhotoIndex + 1} of {photos?.length || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
