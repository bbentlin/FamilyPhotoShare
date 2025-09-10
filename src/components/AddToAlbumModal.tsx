"use client";

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  where,
  updateDoc,
  doc,
  arrayUnion,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import LoadingSpinner from "./LoadingSpinner";
import PhotoImage from "./PhotoImage";
import { Album, Photo } from "@/types";
import { toast } from "react-hot-toast";

// CACHING IMPORTS
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

interface AddToAlbumModalProps {
  isOpen: boolean;
  onClose: () => void;
  photo: Photo;
  db: any;
}

export default function AddToAlbumModal(props: AddToAlbumModalProps) {
  if (!props.db) {
    return null;
  }

  return <AddToAlbumModalContent {...props} />;
}

// Separate child: hooks run only after db exists
function AddToAlbumModalContent({
  isOpen,
  onClose,
  photo,
  db,
}: AddToAlbumModalProps) {
  const { user } = useAuth();
  const [adding, setAdding] = useState(false);
  const [selectedAlbums, setSelectedAlbums] = useState<string[]>([]);

  // ✅ Create query using standard Firestore functions
  const albumsQuery = useMemo(() => {
    if (!user || !db) return null;

    return query(collection(db, "albums"), orderBy("createdAt", "desc"));
  }, [user, db]);

  const {
    data: albums,
    loading: isLoadingAlbums,
    error: albumsError,
    refetch: refetchAlbums,
  } = useCachedFirebaseQuery<Album>(albumsQuery, {
    cacheKey: `user_albums_for_photo_${user?.uid || "none"}`,
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime: false,
    staleWhileRevalidate: true,
  });

  // Reset selection when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAlbums([]);
      setAdding(false);
    }
  }, [isOpen]);

  const handleAlbumToggle = (albumId: string) => {
    setSelectedAlbums((prev) =>
      prev.includes(albumId)
        ? prev.filter((id) => id !== albumId)
        : [...prev, albumId]
    );
  };

  const handleAddToAlbums = async () => {
    if (!user || selectedAlbums.length === 0) return;

    setAdding(true);
    try {
      // Update each selected album
      await Promise.all(
        selectedAlbums.map(async (albumId) => {
          const albumRef = doc(db, "albums", albumId);
          await updateDoc(albumRef, {
            photos: arrayUnion(photo.id),
            photoCount:
              (albums?.find((a) => a.id === albumId)?.photoCount ?? 0) + 1,
            updatedAt: serverTimestamp(),
          });
        })
      );

      // Invalidate cache
      if (user) {
        CacheInvalidationManager.invalidateForAction(
          "photo-add-to-album",
          user.uid
        );
      }

      toast.success(
        `Photo added to ${selectedAlbums.length} album${
          selectedAlbums.length > 1 ? "s" : ""
        }!`
      );
      onClose();
    } catch (error) {
      console.error("Error adding photo to albums:", error);
      toast.error("Failed to add photo to albums. Please try again.");
    } finally {
      setAdding(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Add to Album
          </h2>
          <button
            onClick={onClose}
            disabled={adding}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Photo Preview */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
              <PhotoImage
                src={photo.url}
                alt={photo.title || "Photo"}
                className="w-full h-full object-cover"
                fill
                loading="lazy"
              />
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">
                {photo.title || "Untitled Photo"}
              </h3>
              {photo.description && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {photo.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Albums List */}
        <div className="p-6 flex-1 overflow-y-auto">
          {albumsError ? (
            <div className="text-center py-8">
              <svg
                className="mx-auto h-12 w-12 text-red-400 mb-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-600 dark:text-red-400 mb-2">
                Error loading albums
              </p>
              <button
                onClick={refetchAlbums}
                className="text-sm text-red-600 dark:text-red-400 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          ) : isLoadingAlbums ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner message="Loading albums..." />
            </div>
          ) : albums && albums.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Select albums to add this photo to:
              </p>
              {albums.map((album) => {
                const isSelected = selectedAlbums.includes(album.id);
                const isPhotoInAlbum = album.photos?.includes(photo.id);

                return (
                  <div
                    key={album.id}
                    className={`flex items-center p-3 rounded-lg border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500"
                    } ${isPhotoInAlbum ? "opacity-50 cursor-not-allowed" : ""}`}
                    onClick={() =>
                      !isPhotoInAlbum && !adding && handleAlbumToggle(album.id)
                    }
                  >
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 mr-3">
                      {album.coverPhoto ? (
                        <PhotoImage
                          src={album.coverPhoto}
                          alt={album.title}
                          className="w-full h-full object-cover"
                          fill
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
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
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-white truncate">
                        {album.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {album.photoCount || 0} photos
                      </p>
                    </div>
                    <div className="ml-3">
                      {isPhotoInAlbum ? (
                        <div className="text-green-600 dark:text-green-400 text-sm font-medium">
                          ✓ Already added
                        </div>
                      ) : (
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? "border-blue-500 bg-blue-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
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
                  d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                No albums found
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Create an album first to organize your photos
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedAlbums.length > 0 && (
              <span>
                {selectedAlbums.length} album
                {selectedAlbums.length > 1 ? "s" : ""} selected
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={adding}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-300 font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAddToAlbums}
              disabled={adding || selectedAlbums.length === 0}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                adding || selectedAlbums.length === 0
                  ? "bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {adding ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Adding...
                </div>
              ) : (
                `Add to ${selectedAlbums.length || ""} Album${
                  selectedAlbums.length !== 1 ? "s" : ""
                }`
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
