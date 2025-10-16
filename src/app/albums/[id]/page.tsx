"use client";
import { useDemo } from "@/context/DemoContext";
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
  arrayRemove,
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
  const { canWrite } = useDemo(); 
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;
  const db = getDb();

  // --- State ---
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isManageMode, setIsManageMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<Set<string>>(
    new Set()
  );

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

      if (actualCount !== storedCount) {
        console.log(`Fixing photoCount: ${storedCount} → ${actualCount}`);
        try {
          const albumRef = doc(db, "albums", albumId);
          await updateDoc(albumRef, {
            photoCount: actualCount,
          });
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
      // Block demo users
      if (!canWrite) {
        toast.error("Demo mode: Adding photos to albums is disabled");
        return;
      }

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

        const newPhotoCount = (photos?.length || 0) + newPhotos.length;
        batch.update(albumRef, {
          photoCount: newPhotoCount,
        });

        await batch.commit();

        if (user) {
          CacheInvalidationManager.invalidateAlbumPhotos(albumId);
          CacheInvalidationManager.invalidateAlbums(user.uid);
          CacheInvalidationManager.invalidatePhotos(user.uid);
        }

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
    [canWrite, albumId, db, user, photos, refetchPhotos, refetchAlbum]
  );

  const togglePhotoSelection = useCallback((photoId: string) => {
    setSelectedPhotoIds((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  }, []);

  const handleRemoveSelected = useCallback(async () => {
    if (selectedPhotoIds.size === 0) return;

    const confirmRemove = window.confirm(
      `Remove ${selectedPhotoIds.size} photo(s) from this album? The photos will not be deleted, just removed from the album.`
    );

    if (!confirmRemove) return;

    const toastId = toast.loading(
      `Removing ${selectedPhotoIds.size} photo(s)...`
    );

    try {
      const batch = writeBatch(db);
      const albumRef = doc(db, "albums", albumId);

      selectedPhotoIds.forEach((photoId) => {
        const photoRef = doc(db, "photos", photoId);
        batch.update(photoRef, {
          albums: arrayRemove(albumId),
        });
      });

      const newPhotoCount = (photos?.length || 0) - selectedPhotoIds.size;
      batch.update(albumRef, {
        photoCount: newPhotoCount,
      });

      await batch.commit();

      if (user) {
        CacheInvalidationManager.invalidateAlbumPhotos(albumId);
        CacheInvalidationManager.invalidateAlbums(user.uid);
        CacheInvalidationManager.invalidatePhotos(user.uid);
      }

      setSelectedPhotoIds(new Set());
      setIsManageMode(false);

      setTimeout(() => {
        refetchPhotos();
        refetchAlbum();
      }, 500);

      toast.success(`${selectedPhotoIds.size} photo(s) removed!`, {
        id: toastId,
      });
    } catch (error) {
      console.error("Error removing photos:", error);
      toast.error("Failed to remove photos.", { id: toastId });
    }
  }, [
    selectedPhotoIds,
    db,
    albumId,
    photos,
    user,
    refetchPhotos,
    refetchAlbum,
  ]);

  const handleCancelManage = useCallback(() => {
    setIsManageMode(false);
    setSelectedPhotoIds(new Set());
  }, []);

  const openPhotoModal = useCallback(
    (photo: Photo, index: number) => {
      if (!isManageMode) {
        setSelectedPhoto(photo);
        setSelectedPhotoIndex(index);
      }
    },
    [isManageMode]
  );

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

  const isOwner = album.createdBy === user?.uid;

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
                {isOwner && photos && photos.length > 0 && (
                  <>
                    {isManageMode ? (
                      <>
                        <button
                          onClick={handleRemoveSelected}
                          disabled={selectedPhotoIds.size === 0}
                          className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Remove ({selectedPhotoIds.size})
                        </button>
                        <button
                          onClick={handleCancelManage}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setIsManageMode(true)}
                          className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
                        >
                          Manage Photos
                        </button>
                        <Link
                          href={`/albums/${albumId}/edit`}
                          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                        >
                          Edit Album
                        </Link>
                      </>
                    )}
                  </>
                )}
                {!isOwner && album.createdBy === user?.uid && (
                  <Link
                    href={`/albums/${albumId}/edit`}
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Edit Album
                  </Link>
                )}
              </div>
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
              {photos.map((photo, index) => {
                const isSelected = selectedPhotoIds.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    className={`relative aspect-square overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-700 cursor-pointer group ${
                      isManageMode ? "ring-2 ring-offset-2" : ""
                    } ${
                      isSelected
                        ? "ring-blue-500"
                        : isManageMode
                        ? "ring-transparent"
                        : ""
                    }`}
                    onClick={() =>
                      isManageMode
                        ? togglePhotoSelection(photo.id)
                        : openPhotoModal(photo, index)
                    }
                  >
                    <PhotoImage
                      src={photo.url}
                      alt={photo.title || "Photo"}
                      className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                      fill
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
                      priority={index < 12}
                    />
                    {isManageMode && (
                      <div
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 ${
                          isSelected
                            ? "bg-blue-600 border-blue-600"
                            : "bg-white border-gray-300"
                        } flex items-center justify-center`}
                      >
                        {isSelected && (
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
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
                    disabled={!canWrite} 
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    title={
                      !canWrite ? "Demo mode: This action is disabled" : ""
                    }
                  >
                    Add from Photos
                  </button>
                  <Link
                    href={canWrite ? `/upload?albumId=${albumId}` : "#"} 
                    onClick={(e) => {
                      if (!canWrite) {
                        e.preventDefault();
                        toast.error("Demo mode: Uploading is disabled");
                      }
                    }}
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
        {selectedPhoto && !isManageMode && (
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
