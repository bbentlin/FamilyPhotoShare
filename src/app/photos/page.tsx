"use client";

import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import ThemeToggle from "@/components/ThemeToggle";
import { Photo } from "@/types";
import { usePhotosWithPagination } from "@/hooks/usePhotosWithPagination";
import InfiniteScrollGrid from "@/components/InfiniteScrollGrid";
import PhotoImage from "@/components/PhotoImage";
import VirtualPhotoGrid from "@/components/VirtualPhotoGrid";
import VirtualPhotoItem from "@/components/VirtualPhotoItem";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import ImageDebugger from "@/components/ImageDebugger";

const PhotoModal = lazy(() => import("@/components/PhotoModal"));
const AddToAlbumModal = lazy(() => import("@/components/AddToAlbumModal"));

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

// SortablePhoto component
const SortablePhoto = React.memo(
  function SortablePhoto({
    photo,
    onClick,
    onAddToAlbum,
    priority = false,
  }: {
    photo: Photo;
    onClick: () => void;
    onAddToAlbum: () => void;
    priority?: boolean;
  }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: photo.id });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };

    // Memoize touch handlers to prevent recreation on every render
    const touchHandler = React.useRef({
      isTouching: false,
      startTime: 0,
      moved: false,
    });

    // Use callback to memoize event handlers
    const handleTouchStart = useCallback((e: React.TouchEvent) => {
      touchHandler.current.startTime = Date.now();
      touchHandler.current.isTouching = true;
      touchHandler.current.moved = false;
    }, []);

    const handleTouchMove = useCallback(() => {
      touchHandler.current.moved = true;
    }, []);

    const handleTouchEnd = useCallback(
      (e: React.TouchEvent) => {
        const { moved, startTime } = touchHandler.current;
        touchHandler.current.isTouching = false;

        if (!moved && Date.now() - startTime < 300) {
          const target = e.target as HTMLElement;
          if (!target.closest("button") && !target.closest("[data-drag]")) {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }
        }
      },
      [onClick]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        if ("ontouchstart" in window) return;

        const target = e.target as HTMLElement;
        if (target.closest("button") || target.closest("[data-drag]")) {
          return;
        }
        onClick();
      },
      [onClick]
    );

    const handleAddToAlbum = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onAddToAlbum();
      },
      [onAddToAlbum]
    );

    return (
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`group relative aspect-square min-h-[200px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${
          isDragging ? "opacity-50 z-50" : ""
        }`}
      >
        {/* Photo container */}
        <div
          className="relative w-full h-full cursor-pointer"
          onClick={handleClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            touchAction: "manipulation",
            WebkitTouchCallout: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
          }}
        >
          {photo.url ? (
            <PhotoImage
              src={photo.url}
              alt={photo.title || "Photo"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority} // <-- forward
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-600" />
          )}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />
        </div>

        {/* Add to album button */}
        <button
          onClick={handleAddToAlbum}
          className="absolute top-2 left-2 z-20 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-md opacity-0 group-hover:opacity-100"
          style={{ minHeight: "44px", minWidth: "44px" }}
          title="Add to Album"
        >
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2M6 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </button>

        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          data-drag="true"
          style={{
            position: "absolute",
            top: "8px",
            right: "8px",
            zIndex: 20,
            minHeight: "44px",
            minWidth: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            borderRadius: "6px",
            opacity: 0.6,
            border: "none",
            padding: "8px",
            color: "white",
            touchAction: "none",
            cursor: "move",
            transform: "none !important",
          }}
          className="group-hover:opacity-100 hover:bg-opacity-90"
          title="Drag to reorder"
        >
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
              d="M4 8h16M4 16h16"
            />
          </svg>
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function - only re-render if photo data actually changed
    return (
      prevProps.photo.id === nextProps.photo.id &&
      prevProps.photo.url === nextProps.photo.url &&
      prevProps.photo.title === nextProps.photo.title
    );
  }
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
  const [viewMode, setViewMode] = useState<"grid" | "virtual">("virtual");
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(true);

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

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

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
    // Invalidate cache to refresh data across the app
    if (user) {
      CacheInvalidationManager.invalidateForAction("photo-update", user.uid);
      refresh(); // Use your existing refresh function
    }
  }, [closeAddToAlbumModal, user, refresh]);

  // ADD MANUAL REFRESH WITH CACHE INVALIDATION
  const handleRefresh = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("photo-refresh", user.uid);
      refresh(); // Use your existing refresh function
    }
  }, [user, refresh]);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with theme toggle */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
              >
                ← Back to Dashboard
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {/* ADD REFRESH BUTTON */}
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                title="Refresh photos"
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
              <ThemeToggle />
            </div>
          </div>
        </div>
      </header>

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
          <div className="mt-4 sm:mt-0">
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

                <Link
                  href="/albums/new"
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                >
                  Create Album from Photos →
                </Link>
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
                renderPhoto={({ photo, onClick, onAddToAlbum }) => (
                  <VirtualPhotoItem
                    photo={photo}
                    onClick={onClick}
                    onAddToAlbum={onAddToAlbum}
                  />
                )}
              />
            ) : (
              // Standard Grid with Drag and Drop
              <InfiniteScrollGrid
                hasMore={hasMore}
                loading={photosLoading}
                onLoadMore={loadMore}
              >
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={photos.map((p) => p.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {photos.map((photo, index) => (
                        <div key={photo.id} className="aspect-square w-full">
                          <SortablePhoto
                            key={photo.id}
                            photo={photo}
                            onClick={() => openPhotoModal(photo, index)}
                            onAddToAlbum={() => openAddToAlbumModal(photo)}
                            priority={index < 6} // <-- first row eager
                          />
                        </div>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
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

      {/* Add to Album Modal */}
      {showAddToAlbumModal && selectedPhotoForAlbum && (
        <Suspense fallback={<AlbumModalLoadingSpinner />}>
          <AddToAlbumModal
            photo={selectedPhotoForAlbum}
            isOpen={showAddToAlbumModal}
            onClose={closeAddToAlbumModal}
            onSuccess={handleAlbumSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}
