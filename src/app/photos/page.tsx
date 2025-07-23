"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs, query, orderBy } from "@firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
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
import AddToAlbumModal from "@/components/AddToAlbumModal";
import ThemeToggle from "@/components/ThemeToggle";
import { Photo } from "@/types";
import SafeImage from "@/components/SafeImage";
import PhotoModal from "@/components/PhotoModal";

export default function PhotosPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [showAddToAlbumModal, setShowAddToAlbumModal] = useState(false);
  const [selectedPhotoForAlbum, setSelectedPhotoForAlbum] =
    useState<Photo | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    async function fetchAllPhotos() {
      try {
        let photosQuery;

        switch (sortBy) {
          case "oldest":
            photosQuery = query(
              collection(db, "photos"),
              orderBy("createdAt", "asc")
            );
            break;
          case "title":
            photosQuery = query(
              collection(db, "photos"),
              orderBy("title", "asc")
            );
            break;
          default: // newest
            photosQuery = query(
              collection(db, "photos"),
              orderBy("createdAt", "desc")
            );
        }

        const photoSnapshot = await getDocs(photosQuery);
        const photosData = photoSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Photo[];
        setPhotos(photosData);
      } catch (error: unknown) {
        console.error("Error fetching photos:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAllPhotos();
  }, [user, router, sortBy]);

  const handleDragEnd = async (event: any) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = photos.findIndex((photo) => photo.id === active.id);
      const newIndex = photos.findIndex((photo) => photo.id === over.id);

      const newPhotos = arrayMove(photos, oldIndex, newIndex);
      setPhotos(newPhotos);
    }
  };

  const openPhotoModal = (photo: any, index: number) => {
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

  // Handlers for the album modal
  const openAddToAlbumModal = (photo: Photo) => {
    setSelectedPhotoForAlbum(photo);
    setShowAddToAlbumModal(true);
  };

  const closeAddToAlbumModal = () => {
    setShowAddToAlbumModal(false);
    setSelectedPhotoForAlbum(null);
  };

  const handleAlbumSuccess = () => {
    // Optionally refresh the photos data to show updated album info
    // You could add a small refresh here or just close the modal
  };

  function SortablePhoto({
    photo,
    onClick,
    onAddToAlbum,
  }: {
    photo: any;
    onClick: () => void;
    onAddToAlbum: () => void;
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

    return (
      <div
        ref={setNodeRef}
        style={style}
        className={`group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${
          isDragging ? "opacity-50 z-50" : ""
        }`}
      >
        {/* Main photo container - simple click/tap handler */}
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={(e) => {
            // Don't open modal if currently dragging
            if (isDragging) {
              e.preventDefault();
              e.stopPropagation();
              return;
            }

            // Don't open modal if clicking on buttons or drag handle
            const target = e.target as HTMLElement;
            if (
              target.closest("button") ||
              target.closest("[data-drag-handle]")
            ) {
              return;
            }

            onClick();
          }}
        >
          {photo.url ? (
            <SafeImage
              src={photo.url}
              alt={photo.title || "Photo"}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
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

          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />

          {/* Photo title */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <p className="text-white text-sm font-medium truncate">
              {photo.title || "Untitled Photo"}
            </p>
          </div>
        </div>

        {/* Add to album button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onAddToAlbum();
          }}
          className="absolute top-2 left-2 z-20 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-md transition-all opacity-0 group-hover:opacity-100"
          style={{
            minHeight: "44px",
            minWidth: "44px",
          }}
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

        {/* Drag handle - Let dnd-kit handle all drag logic */}
        <div
          {...attributes}
          {...listeners}
          data-drag-handle="true"
          className="absolute top-2 right-2 z-20 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-md transition-all opacity-60 group-hover:opacity-100 cursor-move"
          style={{
            minHeight: "44px",
            minWidth: "44px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
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
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              All Photos
            </h1>
            <p className="text-gray-600">
              {photos.length} photos in your collection
            </p>
          </div>

          {/* Sort Controls */}
          <div className="mt-4 sm:mt-0">
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "newest" | "oldest" | "title")
              }
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">By Title</option>
            </select>
          </div>
        </div>

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <span className="text-sm text-gray-500">
                Drag photos to rearrange
              </span>
              <Link
                href="/albums/new"
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Create Album from Photos →
              </Link>
            </div>

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
          </div>
        ) : (
          <div className="text-center py-16">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 mb-4"
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
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              No photos yet
            </h3>
            <p className="text-gray-600 mb-6">
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
        <PhotoModal
          photo={selectedPhoto}
          isOpen={true}
          onClose={closePhotoModal}
          onPrevious={goToPreviousPhoto}
          onNext={goToNextPhoto}
          hasPrevious={selectedPhotoIndex > 0}
          hasNext={selectedPhotoIndex < photos.length - 1}
        />
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
