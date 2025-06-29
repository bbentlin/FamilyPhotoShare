"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  doc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import { use } from "react";
import SetCoverPhotoModal from "@/components/SetCoverPhotoModal";
import PhotoModal from "@/components/PhotoModal";
import ThemeToggle from "@/components/ThemeToggle";
import { Photo, Album } from "@/types";

export default function AlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSetCoverModal, setShowSetCoverModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number>(0);
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const albumId = resolvedParams.id;

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    async function fetchAlbumData() {
      try {
        // Fetch album details
        const albumDoc = await getDoc(doc(db, "albums", albumId));

        if (!albumDoc.exists()) {
          router.push("/albums");
          return;
        }

        const albumData = { id: albumDoc.id, ...albumDoc.data() } as Album;
        setAlbum(albumData);

        // Fetch photos in this album
        const photosQuery = query(
          collection(db, "photos"),
          where("albums", "array-contains", albumId)
        );
        const photoSnapshot = await getDocs(photosQuery);
        const photosData = photoSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Photo[];
        setPhotos(photosData);
      } catch (error: unknown) {
        console.error("Error fetching album:", error);
        router.push("/albums");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAlbumData();
  }, [user, router, albumId]);

  const handleDeleteAlbum = async () => {
    if (!album || isDeleting) return;

    setIsDeleting(true);
    try {
      // Delete the album document
      await deleteDoc(doc(db, "albums", album.id));

      // Remove album reference from photos (if you're tracking that)
      const updatePromises = photos.map((photo) => {
        const updatedAlbums =
          photo.albums?.filter((albumId: string) => albumId !== album.id) || [];
        return updateDoc(doc(db, "photos", photo.id), {
          albums: updatedAlbums,
        });
      });

      await Promise.all(updatePromises);

      // Redirect to albums page
      router.push("/albums");
    } catch (error: unknown) {
      console.error("Error deleting album:", error);
      alert("Failed to delete album. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCoverPhotoUpdate = (newCoverUrl: string) => {
    setAlbum((prev) => (prev ? { ...prev, coverPhoto: newCoverUrl } : null));
  };

  const handleQuickSetCover = async (photoUrl: string) => {
    try {
      const albumRef = doc(db, "albums", albumId);
      await updateDoc(albumRef, {
        coverPhoto: photoUrl,
        updatedAt: new Date(),
      });

      setAlbum((prev) => (prev ? { ...prev, coverPhoto: photoUrl } : null));
    } catch (error: unknown) {
      console.error("Error updating cover photo:", error);
      alert("Failed to update cover photo. Please try again.");
    }
  };

  const openPhotoModal = (photo: any, index: number) => {
    setSelectedPhoto(photo);
    setSelectedPhotoIndex(index);
    setShowPhotoModal(true);
  };

  const closePhotoModal = () => {
    setShowPhotoModal(false);
    setSelectedPhoto(null);
    setSelectedPhotoIndex(0);
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

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Loading album...</p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Album not found
          </h2>
          <Link
            href="/albums"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            ← Back to Albums
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/albums" className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-gray-500 dark:text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-gray-500 dark:text-gray-400">
                  Back to Albums
                </span>
              </Link>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                FPS
              </span>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link
                href="/upload"
                className="bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Upload Photos
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Album Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Album Info */}
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {album.title}
              </h1>
              {album.description && (
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  {album.description}
                </p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                <span>{photos.length} photos</span>
                <span>•</span>
                <span>{album.isPublic ? "Public" : "Private"}</span>
                <span>•</span>
                <span>Created by {album.createdByName}</span>
              </div>
            </div>

            {/* Cover Photo Preview */}
            {album.coverPhoto && (
              <div className="w-32 h-24 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                <img
                  src={album.coverPhoto}
                  alt={`${album.title} cover`}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Album Actions */}
          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <button
              onClick={() => setShowSetCoverModal(true)}
              className="px-4 py-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-600 hover:border-blue-300 dark:hover:border-blue-500 rounded-lg text-sm transition-colors"
            >
              {album.coverPhoto ? "Change Cover" : "Set Cover Photo"}
            </button>

            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 border border-red-200 dark:border-red-600 hover:border-red-300 dark:hover:border-red-500 rounded-lg text-sm transition-colors"
            >
              Delete Album
            </button>

            <Link
              href={`/albums/${album.id}/edit`}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg text-sm transition-colors"
            >
              Edit Album
            </Link>
          </div>
        </div>

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
              Photos in this Album
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {photos.map((photo, index) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer"
                  onClick={(e) => {
                    // Only open modal if we're not clicking on the cover button
                    const target = e.target as HTMLElement;
                    if (!target.closest("button")) {
                      openPhotoModal(photo, index);
                    }
                  }}
                >
                  {photo.url ? (
                    <img
                      src={photo.url}
                      alt={photo.title || "Photo"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <svg
                        className="h-8 w-8 text-gray-400 dark:text-gray-500"
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

                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />

                  {/* Current cover indicator */}
                  {photo.url === album.coverPhoto && (
                    <div className="absolute top-2 left-2 bg-green-600 dark:bg-green-500 text-white px-2 py-1 rounded text-xs font-medium">
                      Cover
                    </div>
                  )}

                  {/* Set as Cover button - show on hover for non-cover photos */}
                  {photo.url && photo.url !== album.coverPhoto && (
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button
                        onClick={(e) => {
                          console.log("🎯 COVER BUTTON CLICKED");
                          e.stopPropagation(); // Prevent container click
                          if (photo.url) {
                            handleQuickSetCover(photo.url);
                          }
                        }}
                        className="bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-1.5 rounded-md transition-all"
                        title="Set as Cover Photo"
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
                            d="M5 3a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 3h14v10l-3-3-2 2-4-4-5 5V6z"
                          />
                        </svg>
                      </button>
                    </div>
                  )}

                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-sm font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.title || "Untitled Photo"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
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
              No photos in this album
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Add photos to get started
            </p>
            <Link
              href="/upload"
              className="inline-flex items-center px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
            >
              Upload Photos
            </Link>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Delete Album
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              Are you sure you want to delete &quot;{album.title}&quot;? This action can
              not be undone. The photos will not be deleted, only the album.
            </p>

            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteAlbum}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 hover:bg-red-700 dark:hover:bg-red-600 text-white rounded-lg disabled:opacity-50 transition-colors"
              >
                {isDeleting ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </div>
                ) : (
                  "Delete Album"
                )}
              </button>
            </div>
          </div>

          {/* Click outside to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)}
          />
        </div>
      )}

      {/* Set Cover Photo Modal */}
      {showSetCoverModal && (
        <SetCoverPhotoModal
          album={album}
          photos={photos.filter((photo) => photo.url)}
          isOpen={showSetCoverModal}
          onClose={() => setShowSetCoverModal(false)}
          onPhotoSelected={handleCoverPhotoUpdate}
        />
      )}

      {/* Photo Modal */}
      {showPhotoModal && selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          isOpen={showPhotoModal}
          onClose={closePhotoModal}
          onPrevious={goToPreviousPhoto}
          onNext={goToNextPhoto}
          hasPrevious={selectedPhotoIndex > 0}
          hasNext={selectedPhotoIndex < photos.length - 1}
        />
      )}
    </div>
  );
}
