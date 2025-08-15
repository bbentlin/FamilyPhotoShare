"use client";

import { useState, useEffect, useMemo, lazy, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { getDb } from "@/lib/firebase";
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

interface SortablePhotoProps {
  photo: Photo;
  onClick: () => void;
  onAddToAlbum?: () => void;
  priority?: boolean;
}

function SortablePhoto({
  photo,
  onClick,
  onAddToAlbum,
  priority = false,
}: SortablePhotoProps) {
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

  const [isDragOperation, setIsDragOperation] = useState(false);

  const handleContainerTouchStart = (e: React.TouchEvent) => {
    if (isDragging) {
      e.stopPropagation();
      return;
    }
    const startX = e.touches[0].clientX;
    const startY = e.touches[0].clientY;

    const handleTouchMove = (moveEvent: TouchEvent) => {
      const moveX = moveEvent.touches[0].clientX;
      const moveY = moveEvent.touches[0].clientY;
      const distance = Math.hypot(moveX - startX, moveY - startY);
      if (distance > 10) {
        setIsDragOperation(true);
        document.removeEventListener("touchmove", handleTouchMove);
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
      setTimeout(() => setIsDragOperation(false), 100);
    };

    document.addEventListener("touchmove", handleTouchMove);
    document.addEventListener("touchend", handleTouchEnd);
  };

  const handleContainerTouchEnd = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (isDragging || isDragOperation || target.closest("button")) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => onClick(), 10);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging || isDragOperation) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, width: "100%", height: "100%" }}
      {...attributes}
      className={`group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${
        isDragging ? "opacity-50 z-50" : ""
      }`}
    >
      <div
        className="relative w-full h-full cursor-pointer"
        onClick={handleClick}
        onTouchStart={handleContainerTouchStart}
        onTouchEnd={handleContainerTouchEnd}
        style={{
          touchAction: isDragging ? "none" : "manipulation",
          pointerEvents: isDragging ? "none" : "auto",
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
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 16vw"
            priority={priority}
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />

        <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
          <p className="text-white text-sm font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
            {photo.title || "Untitled Photo"}
          </p>
        </div>

        {onAddToAlbum && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToAlbum();
              }}
              className="bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-1.5 rounded-md transition-all"
              style={{
                touchAction: "manipulation",
                minHeight: 44,
                minWidth: 44,
              }}
              title="Add to Album"
              aria-label="Add to album"
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
            </button>
          </div>
        )}

        <div
          {...listeners}
          className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity cursor-move z-10 p-1"
          style={{
            touchAction: "none",
            background: "rgba(0,0,0,0.7)",
            borderRadius: 6,
            minHeight: 44,
            minWidth: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Drag to reorder"
          onTouchStart={(e) => {
            setIsDragOperation(true);
            e.stopPropagation();
          }}
          aria-label="Drag handle"
          role="button"
        >
          <svg
            className="h-4 w-4 text-white"
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
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const recentPhotosQuery = useMemo(() => {
    if (!user) return null;
    return query(
      collection(getDb(), "photos"),
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
    data: albums,
    loading: albumsLoading,
    isStale: albumsStale,
  } = useCachedAlbums(true);

  const [familyMembers] = useState<Array<{ id: string; [key: string]: any }>>(
    []
  );

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
  const handleAlbumSuccess = () => closeAddToAlbumModal();

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Photos */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Photos
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
                    {/* Recent Photos grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {photos.map((photo, index) => (
                        <SortablePhoto
                          key={photo.id}
                          photo={photo}
                          onClick={() => openPhotoModal(photo, index)}
                          onAddToAlbum={() => openAddToAlbumModal(photo)}
                          priority={index < 6} // <-- first row eager
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

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Albums */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Albums
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
                  {albums.slice(0, 3).map((album, i) => (
                    <Link
                      key={album.id}
                      href={`/albums/${album.id}`}
                      className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 mr-3">
                        {album.coverPhoto ? (
                          <PhotoImage
                            src={album.coverPhoto}
                            alt={album.title}
                            className="w-12 h-12 object-cover rounded"
                            width={48}
                            height={48}
                            sizes="48px"
                            priority={true} // <-- eager (tiny, above the fold)
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                            <svg
                              className="h-6 w-6 text-gray-400 dark:text-gray-500"
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

            {/* Family Members - keep existing implementation for now */}
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
                {familyMembers.slice(0, 6).map((member) => (
                  <div key={member.id} className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 mb-2 flex items-center justify-center">
                      {member.photoUrl ? (
                        <PhotoImage
                          src={member.photoUrl}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                          width={40}
                          height={40}
                          sizes="40px"
                        />
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                          {member.name?.[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-600 dark:text-gray-300 text-center truncate w-12">
                      {member.name}
                    </span>
                  </div>
                ))}

                <Link
                  href="/invite"
                  className="flex flex-col items-center group"
                >
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 group-hover:bg-blue-100 dark:group-hover:bg-blue-900 flex items-center justify-center mb-2 transition-colors">
                    <svg
                      className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400"
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
                  <span className="text-xs text-blue-600 dark:text-blue-400 text-center">
                    Invite
                  </span>
                </Link>
              </div>

              {familyMembers.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-3">
                    No family members yet
                  </p>
                  <Link
                    href="/invite"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium"
                  >
                    Invite your family →
                  </Link>
                </div>
              )}
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
            onSuccess={handleAlbumSuccess}
          />
        </Suspense>
      )}
    </div>
  );
}
