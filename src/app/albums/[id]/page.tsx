"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  doc,
  collection,
  query,
  where,
  orderBy,
  writeBatch,
  arrayUnion,
  getDocs,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";
import { Album, Photo } from "@/types";
import Link from "next/link";
import PhotoImage from "@/components/PhotoImage";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "react-hot-toast";
import { useCachedFirebaseDoc } from "@/hooks/useCachedFirebaseDoc";
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

// Lazy load modals for better performance
const PhotoModal = lazy(() => import("@/components/PhotoModal"));
const AlbumSelectorModal = lazy(
  () => import("@/components/AlbumSelectorModal")
);

const ModalLoadingSpinner = () => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
  </div>
);

export default function AlbumPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;
  const db = getDb();

  // --- State ---
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false); // ✅ State to control the modal

  // --- Data Fetching using Caching Hooks ---
  // This is now the SINGLE source of truth for your data.
  const albumDocRef = useMemo(
    () => (albumId ? doc(db, "albums", albumId) : null),
    [albumId, db]
  );

  const {
    data: album,
    loading: albumLoading,
    error: albumError,
    refetch: refetchAlbum, // ✅ ADD: Get refetch function
  } = useCachedFirebaseDoc<Album>(albumDocRef, {
    cacheKey: `album_${albumId}`,
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime: true,
  });

  const photosQuery = useMemo(
    () =>
      albumId
        ? query(
            collection(db, "photos"),
            where("albums", "array-contains", albumId),
            orderBy("createdAt", "desc")
          )
        : null,
    [albumId, db]
  );

  const {
    data: photos,
    loading: photosLoading,
    error: photosError,
    refetch: refetchPhotos, // ✅ ADD: Get refetch function
  } = useCachedFirebaseQuery<Photo>(photosQuery, {
    cacheKey: `album_photos_${albumId}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: true,
  });

  // ✅ ADD: Debug logging
  useEffect(() => {
    if (album) {
      console.group("🔍 Album Debug");
      console.log("Album ID:", albumId);
      console.log("Album title:", album.title);
      console.log("Album photoCount:", album.photoCount);
      console.log("Photos loaded:", photos?.length || 0);
      console.log("Photos loading:", photosLoading);
      console.log("Photos error:", photosError);

      // Check localStorage cache
      const cacheKey = `album_photos_${albumId}`;
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        console.log("Cache timestamp:", new Date(data.timestamp));
        console.log("Cached photos:", data.data?.length || 0);
      }
      console.groupEnd();
    }
  }, [album, albumId, photos, photosLoading, photosError]);

  // ✅ ADD: Force cache clear and refetch
  const handleClearCacheAndRefetch = useCallback(async () => {
    // Clear localStorage
    localStorage.removeItem(`album_photos_${albumId}`);
    localStorage.removeItem(`album_${albumId}`);

    // Invalidate cache manager
    if (user?.uid) {
      CacheInvalidationManager.invalidateAlbumPhotos(albumId);
      CacheInvalidationManager.invalidateAlbums(user.uid);
    }

    // Force refetch
    await Promise.all([refetchPhotos(), refetchAlbum()]);

    toast.success("Cache cleared and data refreshed!");
  }, [albumId, user, refetchPhotos, refetchAlbum]);

  // ✅ MODIFY: Update handlePhotosAdded to invalidate cache
  const handlePhotosAdded = useCallback(
    async (newPhotos: Photo[]) => {
      if (!albumId || newPhotos.length === 0) return;

      const toastId = toast.loading(
        `Adding ${newPhotos.length} photo(s) to album...`
      );
      try {
        const batch = writeBatch(db);
        const albumRef = doc(db, "albums", albumId);

        newPhotos.forEach((photo) => {
          const photoRef = doc(db, "photos", photo.id);
          batch.update(photoRef, {
            albums: arrayUnion(albumId),
          });
        });

        batch.update(albumRef, {
          photoCount: (album?.photoCount || 0) + newPhotos.length,
        });

        await batch.commit();

        // ✅ CHANGE: More aggressive cache invalidation
        localStorage.removeItem(`album_photos_${albumId}`);
        localStorage.removeItem(`album_${albumId}`);

        if (user) {
          CacheInvalidationManager.invalidateAlbumPhotos(albumId);
          CacheInvalidationManager.invalidateAlbums(user.uid);
          CacheInvalidationManager.invalidatePhotos(user.uid);
        }

        // ✅ ADD: Force refetch after a short delay
        setTimeout(() => {
          refetchPhotos();
          refetchAlbum();
        }, 500);

        toast.success(`${newPhotos.length} photo(s) added successfully!`, {
          id: toastId,
        });
        setIsSelectorOpen(false);
      } catch (error) {
        console.error("Error adding photos to album:", error);
        toast.error("Failed to add photos.", { id: toastId });
      }
    },
    [albumId, db, user, album?.photoCount, refetchPhotos, refetchAlbum]
  );

  // ✅ FIX: Function to scan and re-link photos
  const handleFixAlbum = useCallback(async () => {
    if (!album || !user) return;

    const confirmFix = window.confirm(
      `This will scan all photos and re-link those that mention "${album.title}". Continue?`
    );

    if (!confirmFix) return;

    const toastId = toast.loading("Scanning photos...");

    try {
      // Get ALL photos
      const allPhotosQuery = query(collection(db, "photos"));
      const allPhotosSnap = await getDocs(allPhotosQuery);

      const photosToFix: Photo[] = [];

      allPhotosSnap.forEach((docSnap) => {
        const photo = { id: docSnap.id, ...docSnap.data() } as Photo;

        // Find photos that mention this album's keywords but don't have the album ID
        const shouldBeInAlbum =
          photo.title?.toLowerCase().includes("maddie") ||
          photo.title?.toLowerCase().includes("graduation") ||
          photo.description?.toLowerCase().includes("maddie") ||
          photo.description?.toLowerCase().includes("graduation");

        const hasAlbumId = photo.albums?.includes(albumId);

        if (shouldBeInAlbum && !hasAlbumId) {
          photosToFix.push(photo);
        }
      });

      console.log(`Found ${photosToFix.length} photos to re-link`);

      if (photosToFix.length === 0) {
        toast.success("No photos need fixing!", { id: toastId });
        return;
      }

      // ✅ FIX: Use multiple batches if needed (Firestore batch limit is 500)
      const batchSize = 500;
      const batches = [];

      for (let i = 0; i < photosToFix.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = photosToFix.slice(i, i + batchSize);

        chunk.forEach((photo) => {
          const photoRef = doc(db, "photos", photo.id);
          batch.update(photoRef, {
            albums: arrayUnion(albumId),
          });
        });

        batches.push(batch.commit());
      }

      // Execute all batches
      await Promise.all(batches);

      // ✅ FIX: Recalculate the actual photoCount from Firestore
      const updatedPhotosQuery = query(
        collection(db, "photos"),
        where("albums", "array-contains", albumId)
      );
      const updatedSnap = await getDocs(updatedPhotosQuery);
      const actualCount = updatedSnap.size;

      // Update album photoCount separately
      const albumRef = doc(db, "albums", albumId);
      const finalBatch = writeBatch(db);
      finalBatch.update(albumRef, {
        photoCount: actualCount,
      });
      await finalBatch.commit();

      toast.success(
        `Re-linked ${photosToFix.length} photos! Album now has ${actualCount} total.`,
        { id: toastId }
      );

      // Clear cache and refetch
      await handleClearCacheAndRefetch();
    } catch (error: any) {
      console.error("Error fixing album:", error);
      toast.error(error?.message || "Failed to fix album", { id: toastId });
    }
  }, [album, user, db, albumId, handleClearCacheAndRefetch]);

  // --- Effects ---
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // --- Event Handlers ---
  const openPhotoModal = useCallback((photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  }, []);

  const closePhotoModal = useCallback(() => setSelectedPhoto(null), []);

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

  // --- Render Logic ---
  if (authLoading || albumLoading || (photosLoading && !photos)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading album..." />
      </div>
    );
  }

  if (albumError || photosError) {
    return (
      <div className="text-center p-8">
        <p className="text-red-500">Error loading album data.</p>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Album Not Found</h1>
          <Link href="/albums" className="text-blue-500 hover:underline mt-4">
            Back to Albums
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-4">
              <Link
                href="/albums"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                ← Back to Albums
              </Link>

              <div className="flex gap-2">
                {/* ✅ ADD: Fix Album button */}
                <button
                  onClick={handleFixAlbum}
                  className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded"
                  title="Scan and re-link photos to this album"
                >
                  🔧 Fix Album
                </button>

                <button
                  onClick={handleClearCacheAndRefetch}
                  className="px-3 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-xs rounded"
                  title="Clear cache and force refresh"
                >
                  🔄 Force Refresh
                </button>
              </div>

              {album.createdBy === user?.uid && (
                <Link
                  href={`/albums/${albumId}/edit`}
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Edit Album
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {album.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {album.description}
            </p>
          </div>

          {photos && photos.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer group"
                  onClick={() => openPhotoModal(photo, index)}
                >
                  <PhotoImage
                    src={photo.url}
                    alt={photo.title || "Photo"}
                    className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                    fill
                    sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                    priority={index < 12}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No photos in this album
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Add some photos to bring this album to life
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  {/* ✅ THIS IS THE FIX: This is now a button that opens the modal */}
                  <button
                    onClick={() => setIsSelectorOpen(true)}
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Add from Photos
                  </button>
                  <Link
                    href={`/upload?albumId=${albumId}`}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                  >
                    Upload New Photos
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ✅ MODALS ARE RENDERED HERE */}
      <Suspense fallback={<ModalLoadingSpinner />}>
        {selectedPhoto && (
          <PhotoModal
            photo={selectedPhoto}
            isOpen={true}
            onClose={closePhotoModal}
            onPrevious={goToPreviousPhoto}
            onNext={goToNextPhoto}
            hasPrevious={selectedPhotoIndex > 0}
            hasNext={photos ? selectedPhotoIndex < photos.length - 1 : false}
          />
        )}
        {isSelectorOpen && (
          <AlbumSelectorModal
            isOpen={isSelectorOpen}
            onClose={() => setIsSelectorOpen(false)}
            onAddPhotos={handlePhotosAdded}
            existingPhotoIds={photos?.map((p) => p.id) || []}
          />
        )}
      </Suspense>
    </>
  );
}
