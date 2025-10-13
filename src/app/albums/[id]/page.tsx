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
  updateDoc,
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
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  // --- Data Fetching using Caching Hooks ---
  const albumDocRef = useMemo(
    () => (albumId ? doc(db, "albums", albumId) : null),
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
    refetch: refetchPhotos,
  } = useCachedFirebaseQuery<Photo>(photosQuery, {
    cacheKey: `album_photos_${albumId}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: true,
  });

  // --- Effects ---
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Auto-fix photoCount if it's wrong
  useEffect(() => {
    const fixPhotoCount = async () => {
      if (!album || !photos || photosLoading) return;

      const actualCount = photos.length;
      const storedCount = album.photoCount || 0;

      // If counts don't match, fix it
      if (actualCount !== storedCount) {
        console.log(`Fixing photoCount: ${storedCount} → ${actualCount}`);
        try {
          const albumRef = doc(db, "albums", albumId);
          await updateDoc(albumRef, {
            photoCount: actualCount,
          });
          // Refetch to update UI
          refetchAlbum();
        } catch (error) {
          console.error("Error fixing photoCount:", error);
        }
      }
    };

    fixPhotoCount();
  }, [album, photos, photosLoading, albumId, db, refetchAlbum]);

  // --- Event Handlers ---
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

        // ✅ FIX: Calculate new count based on actual photos
        const newPhotoCount = (photos?.length || 0) + newPhotos.length;
        batch.update(albumRef, {
          photoCount: newPhotoCount,
        });

        await batch.commit();

        // Invalidate cache
        if (user) {
          CacheInvalidationManager.invalidateAlbumPhotos(albumId);
          CacheInvalidationManager.invalidateAlbums(user.uid);
          CacheInvalidationManager.invalidatePhotos(user.uid);
        }

        // Force refetch
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
    [albumId, db, user, photos, refetchPhotos, refetchAlbum]
  );

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
            {album.description && (
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {album.description}
              </p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {photos?.length || 0} {photos?.length === 1 ? "photo" : "photos"}
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

      {/* Modals */}
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
