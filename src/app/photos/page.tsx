"use client";

import React, {
  useState,
  useEffect,
  useCallback,
  lazy,
  Suspense,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Photo } from "@/types";
import { usePhotosWithPagination } from "@/hooks/usePhotosWithPagination";
import { toast } from "react-hot-toast";
import { db } from "@/lib/firebase";
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  orderBy,
  query,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import dynamic from "next/dynamic";
import ImageDebugger from "@/components/ImageDebugger";
import ThemeToggle from "@/components/ThemeToggle";
import PhotoImage from "@/components/PhotoImage";
import VirtualPhotoGrid from "@/components/VirtualPhotoGrid";
import VirtualPhotoItem from "@/components/VirtualPhotoItem";
import PhotoGridItem from "@/components/PhotoGridItem"; // ✅ Import the new component
import Link from "next/link"; // ✅ add
import { arrayMove } from "@dnd-kit/sortable"; // ✅ add
import { addPhotoToAlbums } from "@/lib/albums"; // ✅ add

const PhotoModal = lazy(() => import("@/components/PhotoModal"));
const AddToAlbumModal = dynamic(
  () => import("@/components/AddToAlbumModal").then((m) => m.default),
  { ssr: false, loading: () => <AlbumModalLoadingSpinner /> }
);
const InfiniteScrollGrid = lazy(
  () => import("@/components/InfiniteScrollGrid")
);
const AlbumSelectorModal = dynamic(
  () => import("@/components/AlbumSelectorModal").then((m) => m.default),
  { ssr: false, loading: () => <AlbumModalLoadingSpinner /> }
);

const ModalLoadingSpinner = () => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span className="text-gray-700 dark:text-gray-300">Loading...</span>
    </div>
  </div>
);

const AlbumModalLoadingSpinner = () => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center space-x-3">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      <span className="text-gray-700 dark:text-gray-300">
        Loading album options...
      </span>
    </div>
  </div>
);

export default function PhotosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  // State declarations - keep these at the top in consistent order
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [selectedPhotoForAlbum, setSelectedPhotoForAlbum] =
    useState<Photo | null>(null);
  const [viewMode, setViewMode] = useState<"virtual" | "grid">("virtual"); // <-- Default is "virtual"
  const [showCreateFromPhotos, setShowCreateFromPhotos] = useState(false);

  // optional: persist view mode across visits
  useEffect(() => {
    const saved =
      typeof window !== "undefined" && localStorage.getItem("viewMode");
    if (saved === "virtual" || saved === "grid") setViewMode(saved);
  }, []);
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem("viewMode", viewMode);
  }, [viewMode]);

  // Custom hook - keep this after state declarations
  const {
    photos: fetchedPhotos,
    loading: photosLoading,
    hasMore,
    loadMore,
    refresh,
    error,
  } = usePhotosWithPagination(20, sortBy);

  // Local photos state for drag and drop
  const [photos, setPhotos] = useState<Photo[]>([]);

  // Effects - keep these after all state and hook declarations
  useEffect(() => {
    setPhotos(fetchedPhotos);
  }, [fetchedPhotos]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Event handlers - memoize these
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setPhotos((photos) =>
        arrayMove(
          photos,
          photos.findIndex((p) => p.id === active.id),
          photos.findIndex((p) => p.id === over.id)
        )
      );
    }
  }, []);

  const openPhotoModal = useCallback((photo: Photo, idx: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(idx);
  }, []);

  const closePhotoModal = useCallback(() => {
    setSelectedPhoto(null);
  }, []);

  const goToPreviousPhoto = useCallback(() => {
    if (selectedPhotoIndex > 0) {
      const newIndex = selectedPhotoIndex - 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  }, [selectedPhotoIndex, photos]);

  const goToNextPhoto = useCallback(() => {
    if (selectedPhotoIndex < photos.length - 1) {
      const newIndex = selectedPhotoIndex + 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  }, [selectedPhotoIndex, photos]);

  const openAddToAlbumModal = useCallback((photo: Photo) => {
    setSelectedPhotoForAlbum(photo);
    setShowAddToAlbumModal(true);
  }, []);

  const closeAddToAlbumModal = useCallback(() => {
    setShowAddToAlbumModal(false);
    setSelectedPhotoForAlbum(null);
  }, []);

  const handleAlbumSuccess = useCallback(() => {
    closeAddToAlbumModal();
    // optional refresh
    // refresh();
  }, [closeAddToAlbumModal]);

  // ADD MANUAL REFRESH WITH CACHE INVALIDATION
  const handleRefresh = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("photo-refresh", user.uid);
      refresh(); // Use your existing refresh function
    }
  }, [user, refresh]);

  const handleConfirmAlbums = useCallback(
    async (albumIds: string[]) => {
      if (!selectedPhotoForAlbum || !user) return;
      const toastId = toast.loading("Adding photo to album(s)...");
      try {
        await addPhotoToAlbums(selectedPhotoForAlbum.id, albumIds, {
          addedBy: user.uid,
        });
        CacheInvalidationManager.invalidatePhotos(user.uid);
        CacheInvalidationManager.invalidateAlbums(user.uid);
        albumIds.forEach((id) =>
          CacheInvalidationManager.invalidateAlbumPhotos(id)
        );
        toast.success("Photo added to album(s).", { id: toastId });
      } catch (e) {
        console.error("Failed to add photo to albums:", e);
        toast.error("Failed to add photo to album(s).", { id: toastId });
      } finally {
        closeAddToAlbumModal();
      }
    },
    [selectedPhotoForAlbum, user, closeAddToAlbumModal]
  );

  // Create album from selected photos
  const handleCreateAlbumFromPhotos = useCallback(
    async (selectedPhotos: Photo[]) => {
      try {
        if (!user) {
          toast.error("You must be signed in.");
          return;
        }
        if (!selectedPhotos || selectedPhotos.length === 0) {
          toast("Select at least one photo.");
          return;
        }

        const title = window.prompt(
          `Album title for ${selectedPhotos.length} photo${
            selectedPhotos.length > 1 ? "s" : ""
          }:`,
          "New Album"
        );
        if (!title || !title.trim()) {
          toast("Album creation cancelled.");
          return;
        }

        const toastId = toast.loading("Creating album...");
        // 1) Create album
        const albumRef = await addDoc(collection(db, "albums"), {
          title: title.trim(),
          description: "",
          isPublic: false,
          createdBy: user.uid,
          createdByName: user.displayName || user.email || "Unknown",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          photoCount: selectedPhotos.length,
          coverPhoto: selectedPhotos[0]?.url ?? null,
          photos: [], // optional legacy field
          sharedWith: [],
          tags: [],
        });

        // 2) Link photos to the album (batch)
        const batch = writeBatch(db);
        selectedPhotos.forEach((p) => {
          const pRef = doc(db, "photos", p.id);
          batch.update(pRef, { albums: arrayUnion(albumRef.id) });
        });
        // touch album updatedAt
        batch.update(albumRef, { updatedAt: serverTimestamp() });
        await batch.commit();

        // 3) Invalidate caches
        CacheInvalidationManager.invalidateAlbums(user.uid);
        CacheInvalidationManager.invalidateAlbumPhotos(albumRef.id);
        CacheInvalidationManager.invalidatePhotos(user.uid);

        toast.success("Album created.", { id: toastId });
        setShowCreateFromPhotos(false);
        // Optional: navigate to the new album
        // router.push(`/albums/${albumRef.id}`);
      } catch (e) {
        console.error("Create album from photos failed:", e);
        toast.error("Failed to create album.");
      }
    },
    [user]
  );

  // Early returns
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
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

  if (loading || photosLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                All Photos
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                {photos.length} photos in your collection
              </p>
            </div>

            {/* Sort Controls */}
            <div className="mt-4 sm:mt-0 flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => {
                  const newSortBy = e.target.value as
                    | "newest"
                    | "oldest"
                    | "title";
                  setSortBy(newSortBy);
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="title">By Title</option>
              </select>

              {/* Create album from photos button */}
              <button
                type="button"
                onClick={() => setShowCreateFromPhotos(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create album from photos
              </button>
            </div>
          </div>

          {/* Photos Grid */}
          {photos.length > 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Showing {photos.length} photos
                  {hasMore && " • Loading more..."}
                </span>

                {/* View Mode Toggle */}
                <div className="flex items-center gap-4">
                  <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                    <button
                      onClick={() => setViewMode("virtual")}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        viewMode === "virtual"
                          ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      Virtual
                    </button>
                    <button
                      onClick={() => setViewMode("grid")}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        viewMode === "grid"
                          ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-300"
                      }`}
                    >
                      Standard
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === "virtual" ? (
                // Virtual Scrolling Grid
                <VirtualPhotoGrid
                  photos={photos}
                  hasMore={hasMore}
                  loading={photosLoading}
                  onLoadMore={loadMore}
                  onPhotoClick={openPhotoModal}
                  onAddToAlbum={openAddToAlbumModal}
                  // ✅ Use the new component here
                  renderPhoto={({ photo, onClick, onAddToAlbum }) => (
                    <PhotoGridItem
                      photo={photo}
                      priority={false}
                      onPhotoClick={onClick}
                      onAddToAlbumClick={onAddToAlbum}
                    />
                  )}
                />
              ) : (
                // Standard Grid
                <InfiniteScrollGrid
                  hasMore={hasMore}
                  loading={photosLoading}
                  onLoadMore={loadMore}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                    {photos.map((photo, index) => (
                      // ✅ And also use the new component here
                      <PhotoGridItem
                        key={photo.id}
                        photo={photo}
                        priority={index < 6}
                        onPhotoClick={() => openPhotoModal(photo, index)}
                        onAddToAlbumClick={() => openAddToAlbumModal(photo)}
                      />
                    ))}
                  </div>
                </InfiniteScrollGrid>
              )}
            </div>
          ) : (
            <div className="text-center py-16">
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                No photos yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Start building your family photo collection
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upload Your First Photos
              </Link>
            </div>
          )}
        </main>

        {/* Photo Modal */}
        {selectedPhoto && (
          <Suspense fallback={<ModalLoadingSpinner />}>
            <PhotoModal
              photo={selectedPhoto}
              isOpen={true}
              onClose={closePhotoModal}
              onPrevious={goToPreviousPhoto}
              onNext={goToNextPhoto}
              hasPrevious={selectedPhotoIndex > 0}
              hasNext={selectedPhotoIndex < photos.length - 1}
            />
          </Suspense>
        )}

        {/* Add to Album Modal (single) */}
        {showAddToAlbumModal && selectedPhotoForAlbum && (
          <AddToAlbumModal
            isOpen={true}
            photo={selectedPhotoForAlbum}
            onClose={closeAddToAlbumModal}
            onConfirm={handleConfirmAlbums}
          />
        )}

        {/* Create Album From Photos selector */}
        {showCreateFromPhotos && (
          <AlbumSelectorModal
            isOpen={true}
            onClose={() => setShowCreateFromPhotos(false)}
            onAddPhotos={handleCreateAlbumFromPhotos}
            existingPhotoIds={[]} // none blocked
          />
        )}
      </div>
    </>
  );
}
