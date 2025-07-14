"use client";

import { useState, useEffect, memo, lazy, Suspense, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs, query, orderBy, limit } from "firebase/firestore";
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
import ThemeToggle from "@/components/ThemeToggle";
import { Photo, Album } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeImage from "@/components/SafeImage";

// Lazy load modals
const PhotoModal = lazy(() => import("@/components/PhotoModal"));
const AddToAlbumModal = lazy(() => import("@/components/AddToAlbumModal"));

// Sortable Photo Component
const SortablePhoto = memo(function SortablePhoto({
  photo,
  onClick,
  onAddToAlbum,
}: {
  photo: Photo;
  onClick: () => void;
  onAddToAlbum?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: photo.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700"
    >
      {photo.url ? (
        <SafeImage
          src={photo.url}
          alt={photo.title || "Photo"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 cursor-pointer"
          onClick={(e) => {
            e?.stopPropagation();
            console.log("Photo clicked:", photo.title);
            onClick();
          }} 
          loading="lazy"
        />
      ) : (
        <div
          className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <svg
            className="h-8 w-8 text-gray-400 dark:text-gray-300"
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
      )}

      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />

      <div className="absolute bottom-2 left-2 right-2 pointer-events-none">
        <p className="text-white text-sm font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
          {photo.title || "Untitled Photo"}
        </p>
      </div>

      {/* Add to album button - show on hover */}
      {onAddToAlbum && (
        <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddToAlbum();
            }}
            className="bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-1.5 rounded-md transition-all"
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
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Separate drag handle - only this area is draggable */}
      <div
        {...attributes}
        {...listeners}
        className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity cursor-move z-10 p-1"
        title="Drag to reorder"
      >
        <div className="bg-black bg-opacity-70 rounded-md p-2 hover:bg-opacity-90 transition-all">
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
});

const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [recentPhotos, setRecentPhotos] = useState<Photo[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [familyMembers, setFamilyMembers] = useState<
    Array<{ id: string; [key: string]: any }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal state
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);

  // Add these state variables after your existing state declarations
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [selectedPhotoForAlbum, setSelectedPhotoForAlbum] =
    useState<Photo | null>(null);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch data from Firestore
  const debouncedFetchData = useCallback(
    debounce(async () => {
      if (!user || !db) return;

      try {
        const [photoSnapshot, albumSnapshot] = await Promise.all([
          getDocs(
            query(
              collection(db, "photos"),
              orderBy("createdAt", "desc"),
              limit(6)
            )
          ),
          getDocs(
            query(
              collection(db, "albums"),
              orderBy("updatedAt", "desc"),
              limit(4)
            )
          ),
        ]);

        setRecentPhotos(
          photoSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Photo[]
        );
        setAlbums(
          albumSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Album[]
        );
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    }, 300),
    [user, db]
  );

  useEffect(() => {
    let isMounted = true;

    async function fetchData() {
      if (!user) return;

      try {
        setIsLoading(true);

        // Fetch data with timeout
        await Promise.race([
          debouncedFetchData(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Timeout")), 10000)
          ),
        ]);
      } catch (error) {
        console.error("Error fetching data:", error);
        // Set empty arrays instead of hanging
        setRecentPhotos([]);
        setAlbums([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (user && !loading) {
      fetchData();
    }

    return () => {
      isMounted = false;
    };
  }, [user, loading, debouncedFetchData]);

  // Handle drag end for photo reordering
  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = recentPhotos.findIndex(
        (photo) => photo.id === active.id
      );
      const newIndex = recentPhotos.findIndex((photo) => photo.id === over.id);

      const newPhotos = arrayMove(recentPhotos, oldIndex, newIndex);
      setRecentPhotos(newPhotos);

      // Update the order in the local state
      try {
        console.log(
          "Photos reordered:",
          newPhotos.map((p) => p.title)
        );
      } catch (error: unknown) {
        console.error("Error updating photo order:", error);
      }
    }
  };

  // Photo modal funcions
  const openPhotoModal = (photo: Photo, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
  };

  const closePhotoModal = () => {
    setSelectedPhoto(null);
  };

  const goToPreviousPhoto = () => {
    if (selectedPhotoIndex > 0) {
      const newIndex = selectedPhotoIndex - 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(recentPhotos[newIndex]);
    }
  };

  const goToNextPhoto = () => {
    if (selectedPhotoIndex < recentPhotos.length - 1) {
      const newIndex = selectedPhotoIndex + 1;
      setSelectedPhotoIndex(newIndex);
      setSelectedPhoto(recentPhotos[newIndex]);
    }
  };

  // Add these functions after your existing photo modal functions
  const openAddToAlbumModal = (photo: Photo) => {
    setSelectedPhotoForAlbum(photo);
    setShowAddToAlbumModal(true);
  };

  const closeAddToAlbumModal = () => {
    setShowAddToAlbumModal(false);
    setSelectedPhotoForAlbum(null);
  };

  const handleAlbumSuccess = () => {
    // Optionally refresh the photos data
    closeAddToAlbumModal();
  };

  // Update the loading screen
  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading your photos..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Compact Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2">
              <div className="relative h-8 w-8">
                <Image
                  src="/familylogo.png"
                  alt="Family logo"
                  fill
                  sizes="32px"
                  className="object-contain"
                />
              </div>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                Family Photo Share
              </span>
            </Link>

            {/* Right side navigation */}
            <div className="flex items-center gap-4">
              <ThemeToggle />

              <Link
                href="/settings"
                className="text-gray-500 hover:text-gray-700 p-2 rounded-md hover:bg-gray-100"
                title="Settings"
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
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.50a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.50 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.50a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>

              <Link
                href="/upload"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Upload
              </Link>

              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium text-sm">
                  {user?.displayName?.[0] ||
                    user?.email?.[0]?.toUpperCase() ||
                    "U"}
                </div>
                <button
                  onClick={() => logout()}
                  className="text-gray-500 hover:text-gray-700 text-sm"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Welcome back,{" "}
            {user?.displayName || user?.email?.split("@")[0] || "Family Member"}
            !
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
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-green-50 transition-colors"
            >
              <div className="bg-green-100 group-hover:bg-green-200 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-green-600"
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
              <span className="text-sm font-medium text-gray-700 group-hover:text-green-600">
                Create Album
              </span>
            </Link>

            <Link
              href="/invite"
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-purple-50 transition-colors"
            >
              <div className="bg-purple-100 group-hover:bg-purple-200 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-purple-600"
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
              <span className="text-sm font-medium text-gray-700 group-hover:text-purple-600">
                Invite Family
              </span>
            </Link>

            <Link
              href="/photos"
              className="group flex flex-col items-center p-4 rounded-lg hover:bg-amber-50 transition-colors"
            >
              <div className="bg-amber-100 group-hover:bg-amber-200 p-3 rounded-full mb-3">
                <svg
                  className="h-6 w-6 text-amber-600"
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
              <span className="text-sm font-medium text-gray-700 group-hover:text-amber-600">
                View All Photos
              </span>
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Photos with Drag and Drop */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Photos
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

              {recentPhotos.length > 0 ? (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={recentPhotos.map((p) => p.id)}
                    strategy={rectSortingStrategy}
                  >
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {recentPhotos.map((photo, index) => (
                        <SortablePhoto
                          key={photo.id}
                          photo={photo}
                          onClick={() => openPhotoModal(photo, index)}
                          onAddToAlbum={() => openAddToAlbumModal(photo)}
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

          {/* Sidebar - Albums and Family */}
          <div className="space-y-8">
            {/* Albums */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Albums
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
                  {albums.slice(0, 3).map((album) => (
                    <Link
                      key={album.id}
                      href={`/albums/${album.id}`}
                      className="flex items-center p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-200 dark:bg-gray-600 mr-3">
                        {album.coverPhoto ? (
                          <SafeImage 
                            src={album.coverPhoto}
                            alt={album.title}
                            className="w-12 h-12 object-cover rounded"
                            loading="lazy"
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

            {/* Family Members */}
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
                        <SafeImage 
                          src={member.photoUrl}
                          alt={member.name}
                          className="w-10 h-10 rounded-full object-cover"
                          loading="lazy"
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

      {/* Photo Modal */}
      {selectedPhoto && (
        <Suspense fallback={<div>Loading...</div>}>
          <PhotoModal
            photo={selectedPhoto}
            isOpen={true}
            onClose={closePhotoModal}
            onPrevious={goToPreviousPhoto}
            onNext={goToNextPhoto}
            hasPrevious={selectedPhotoIndex > 0}
            hasNext={selectedPhotoIndex < recentPhotos.length - 1}
          />
        </Suspense>
      )}

      {/* Add to Album Modal */}
      {showAddToAlbumModal && selectedPhotoForAlbum && (
        <AddToAlbumModal
          photo={selectedPhotoForAlbum}
          isOpen={showAddToAlbumModal}
          onClose={closeAddToAlbumModal}
          onSuccess={handleAlbumSuccess}
        />
      )}
    </div>
  );
}
