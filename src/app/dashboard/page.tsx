"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Photo, Album } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import PhotoGridItem from "@/components/PhotoGridItem";
import PhotoImage from "@/components/PhotoImage";
import { useCachedAlbums } from "@/hooks/useCachedAlbums";
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";

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

// ✅ REPLACE the old SortablePhoto function with this new one.
function SortablePhoto({
  photo,
  index,
  openPhotoModal,
  openAddToAlbumModal,
}: {
  photo: Photo;
  index: number;
  openPhotoModal: (photo: Photo, index: number) => void;
  openAddToAlbumModal: (photo: Photo) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: photo.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    // ✅ Add the `relative` class here
    <div ref={setNodeRef} style={style} className="relative">
      <PhotoGridItem
        photo={photo}
        priority={index < 6}
        onPhotoClick={() => openPhotoModal(photo, index)}
        onAddToAlbumClick={() => openAddToAlbumModal(photo)}
        dndAttributes={attributes}
        dndListeners={listeners}
        isDragging={isDragging}
      />
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const recentPhotosQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(db, "photos"),
      orderBy("createdAt", "desc"),
      limit(12)
    );
  }, [user]);

  const {
    data: recentPhotosData,
    loading: photosLoading,
    isStale: photosStale,
  } = useCachedFirebaseQuery<Photo>(recentPhotosQuery, {
    cacheKey: "recent_photos",
    cacheTtl: CACHE_CONFIGS.recent.ttl,
    enableRealtime: true,
    staleWhileRevalidate: true,
  });

  const {
    albums,
    loading: albumsLoading,
    isStale: albumsStale,
  } = useCachedAlbums(false);

  const [photos, setPhotos] = useState<Photo[]>([]);
  useEffect(() => {
    setPhotos(recentPhotosData || []);
  }, [recentPhotosData]);

  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [selectedPhotoForAlbum, setSelectedPhotoForAlbum] =
    useState<Photo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const isLoading = loading || photosLoading || albumsLoading;

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    setPhotos(arrayMove(photos, oldIndex, newIndex));
  };

  const openPhotoModal = (photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  };
  const closePhotoModal = () => setSelectedPhoto(null);
  const goToPreviousPhoto = () => {
    if (selectedPhotoIndex > 0) {
      const newIndex = selectedPhotoIndex - 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  };
  const goToNextPhoto = () => {
    if (selectedPhotoIndex < photos.length - 1) {
      const newIndex = selectedPhotoIndex + 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(photos[newIndex]);
    }
  };
  const openAddToAlbumModal = (photo: Photo) => {
    setSelectedPhotoForAlbum(photo);
    setShowAddToAlbumModal(true);
  };
  const closeAddToAlbumModal = () => {
    setShowAddToAlbumModal(false);
    setSelectedPhotoForAlbum(null);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading your photos..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back,{" "}
            {user?.displayName || user?.email?.split("@")[0] || "Family Member"}
            !
            {(photosStale || albumsStale) && (
              <span className="ml-2 text-xs text-yellow-500">
                (updating...)
              </span>
            )}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Manage your family photos and memories
          </p>
        </div>

        {/* Quick Actions Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link
              href="/upload"
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <div className="bg-blue-100 dark:bg-blue-900 group-hover:bg-blue-200 dark:group-hover:bg-blue-800 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-blue-600 dark:text-blue-400"
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
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                Upload Photos
              </span>
            </Link>
            <Link
              href="/albums/new"
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            >
              <div className="bg-green-100 dark:bg-green-900 group-hover:bg-green-200 dark:group-hover:bg-green-800 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
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
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-green-600 dark:group-hover:text-green-400">
                Create Album
              </span>
            </Link>
            <Link
              href="/invite"
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
            >
              <div className="bg-purple-100 dark:bg-purple-900 group-hover:bg-purple-200 dark:group-hover:bg-purple-800 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-purple-600 dark:text-purple-400"
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
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                Invite Family
              </span>
            </Link>
            <Link
              href="/photos"
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
            >
              <div className="bg-amber-100 dark:bg-amber-900 group-hover:bg-amber-200 dark:group-hover:bg-amber-800 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-amber-600 dark:text-amber-400"
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
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-amber-600 dark:group-hover:text-amber-400">
                View All Photos
              </span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
          <div className="lg:col-span-2 h-full">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Photos{" "}
                  {photosStale && (
                    <span className="text-xs text-yellow-500 ml-2">
                      (updating...)
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Drag to rearrange
                  </span>
                  <Link
                    href="/photos"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    View All →
                  </Link>
                </div>
              </div>
              {photos.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={photos.map((p) => p.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 flex-1">
                      {photos.map((photo, index) => (
                        <SortablePhoto
                          key={photo.id}
                          photo={photo}
                          index={index}
                          openPhotoModal={openPhotoModal}
                          openAddToAlbumModal={openAddToAlbumModal}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : (
                <div className="text-center py-12">
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
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    No photos yet
                  </p>
                  <Link
                    href="/upload"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                  >
                    Upload Your First Photo
                  </Link>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-8">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Albums{" "}
                  {albumsStale && (
                    <span className="text-xs text-yellow-500 ml-2">
                      (updating...)
                    </span>
                  )}
                </h2>
                <Link
                  href="/albums"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                >
                  View All →
                </Link>
              </div>
              {albums.length > 0 ? (
                <div className="space-y-3">
                  {albums.slice(0, 3).map((album: Album) => (
                    <Link
                      key={album.id}
                      href={`/albums/${album.id}`}
                      className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 mr-3 flex-shrink-0">
                        {album.coverPhoto ? (
                          <PhotoImage
                            src={album.coverPhoto}
                            alt={album.title}
                            className="w-12 h-12 object-cover"
                            width={48}
                            height={48}
                            sizes="48px"
                            priority={true}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 dark:bg-gray-600" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {album.title}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {album.photoCount || 0} photos
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                    No albums yet
                  </p>
                  <Link
                    href="/albums/new"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    Create your first album →
                  </Link>
                </div>
              )}
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Family
                </h2>
                <Link
                  href="/family"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                >
                  Manage →
                </Link>
              </div>
              <div className="flex flex-wrap gap-3">
                {/* Family members display remains unchanged */}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
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
        <Suspense fallback={<ModalLoadingSpinner />}>
          <AddToAlbumModal
            photo={selectedPhotoForAlbum}
            isOpen={showAddToAlbumModal}
            onClose={closeAddToAlbumModal}
            db={db}
          />
        </Suspense>
      )}
    </div>
  );
}
