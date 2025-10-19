"use client";

import {
  useEffect,
  useState,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useDemo } from "@/context/DemoContext";
import {
  collection,
  query,
  orderBy,
  addDoc,
  writeBatch,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Photo } from "@/types";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "react-hot-toast";
import dynamic from "next/dynamic";
import { addPhotoToAlbums } from "@/lib/albums";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import PhotoGridItem from "@/components/PhotoGridItem";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  TouchSensor,
  MouseSensor,
  DragOverlay,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const PhotoModal = lazy(() => import("@/components/PhotoModal"));
const AddToAlbumModal = dynamic(
  () => import("@/components/AddToAlbumModal").then((m) => m.default),
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

function SortablePhoto({
  photo,
  index,
  openPhotoModal,
  openAddToAlbumModal,
  isDragging: isGlobalDragging,
}: {
  photo: Photo;
  index: number;
  openPhotoModal: (photo: Photo, index: number) => void;
  openAddToAlbumModal: (photo: Photo) => void;
  isDragging: boolean;
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
    touchAction: "none",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? "opacity-30 z-50" : "opacity-100"} ${
        isGlobalDragging ? "pointer-events-none" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <PhotoGridItem
        photo={photo}
        priority={index < 6}
        onPhotoClick={() => !isGlobalDragging && openPhotoModal(photo, index)}
        onAddToAlbumClick={() =>
          !isGlobalDragging && openAddToAlbumModal(photo)
        }
        isDragging={isDragging}
      />
    </div>
  );
}

export default function PhotosPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { canWrite } = useDemo();

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [selectedPhotoForAlbum, setSelectedPhotoForAlbum] =
    useState<Photo | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Fetch ALL photos using cache
  const photosQuery = useMemo(() => {
    if (!user) return null;

    let q = query(collection(db, "photos"));

    if (sortBy === "newest") {
      q = query(q, orderBy("createdAt", "desc"));
    } else if (sortBy === "oldest") {
      q = query(q, orderBy("createdAt", "asc"));
    } else {
      q = query(q, orderBy("title", "asc"));
    }

    return q;
  }, [user, sortBy]);

  const {
    data: fetchedPhotos,
    loading: photosLoading,
    error,
    refetch: refresh,
  } = useCachedFirebaseQuery<Photo>(photosQuery, {
    cacheKey: `all_photos_${sortBy}`,
    cacheTtl: CACHE_CONFIGS.photos.ttl,
    enableRealtime: false,
    staleWhileRevalidate: true,
  });

  const [photos, setPhotos] = useState<Photo[]>([]);

  useEffect(() => {
    setPhotos(fetchedPhotos || []);
  }, [fetchedPhotos]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: any) => {
    setActiveId(event.active.id);
  }, []);

  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    setPhotos((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
  }, []);

  const openPhotoModal = useCallback(
    (photo: Photo, idx: number) => {
      if (activeId) return;
      setSelectedPhoto(photo);
      setSelectedPhotoIndex(idx);
    },
    [activeId]
  );

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

  const openAddToAlbumModal = useCallback(
    (photo: Photo) => {
      if (activeId) return;
      setSelectedPhotoForAlbum(photo);
      setShowAddToAlbumModal(true);
    },
    [activeId]
  );

  const closeAddToAlbumModal = useCallback(() => {
    setShowAddToAlbumModal(false);
    setSelectedPhotoForAlbum(null);
  }, []);

  const handleRefresh = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("photo-refresh", user.uid);
      refresh();
    }
  }, [user, refresh]);

  const handleConfirmAlbums = useCallback(
    async (albumIds: string[]) => {
      if (!canWrite) {
        toast.error("Demo mode: Adding photos to albums is disabled");
        closeAddToAlbumModal();
        return;
      }

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
    [canWrite, selectedPhotoForAlbum, user, closeAddToAlbumModal]
  );

  const activePhoto = activeId ? photos.find((p) => p.id === activeId) : null;

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Error Loading Photos
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
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
        <LoadingSpinner message="Loading photos..." />
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-4 gap-4">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  All Photos ({photos.length})
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="title">By Title</option>
                </select>

                <button
                  onClick={handleRefresh}
                  className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
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

                <Link
                  href="/upload"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  + Upload
                </Link>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {photos.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              <SortableContext
                items={photos.map((p) => p.id)}
                strategy={rectSortingStrategy}
              >
                <div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
                  style={{ touchAction: "pan-y pinch-zoom" }}
                >
                  {photos.map((photo, index) => (
                    <SortablePhoto
                      key={photo.id}
                      photo={photo}
                      index={index}
                      openPhotoModal={openPhotoModal}
                      openAddToAlbumModal={openAddToAlbumModal}
                      isDragging={!!activeId}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={null}>
                {activePhoto ? (
                  <div className="opacity-90 shadow-2xl cursor-grabbing">
                    <PhotoGridItem
                      photo={activePhoto}
                      priority={false}
                      onPhotoClick={() => {}}
                      onAddToAlbumClick={() => {}}
                      isDragging={true}
                    />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
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
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No Photos Yet
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Upload your first photos to get started!
              </p>
              <Link
                href="/upload"
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Upload Photos
              </Link>
            </div>
          )}
        </main>
      </div>

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

      {showAddToAlbumModal && selectedPhotoForAlbum && (
        <AddToAlbumModal
          isOpen={true}
          photo={selectedPhotoForAlbum}
          onClose={() => {
            setShowAddToAlbumModal(false);
            setSelectedPhotoForAlbum(null);
          }}
          onConfirm={handleConfirmAlbums}
        />
      )}
    </>
  );
}
