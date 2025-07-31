"use client";

import { useState, useEffect, useCallback } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Photo, Album } from "@/types";
import LoadingSpinner from "./LoadingSpinner";
import SafeImage from "./SafeImage";
import { toast } from "react-hot-toast";

// CACHING IMPORTS
import { useCachedFirebaseQuery } from "@/hooks/useCachedFirebaseQuery";
import { CACHE_CONFIGS } from "@/lib/firebaseCache";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

interface AddToAlbumModalProps {
  photo: Photo;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function AddToAlbumModal({
  photo,
  isOpen,
  onClose,
  onSuccess,
}: AddToAlbumModalProps) {
  const { user } = useAuth();
  const [selectedAlbum, setSelectedAlbum] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New album creation states
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumDescription, setNewAlbumDescription] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // CACHED ALBUMS QUERY
  const albumsQuery = query(
    collection(db, "albums"),
    orderBy("updatedAt", "desc")
  );

  const {
    data: allAlbums,
    loading: isLoading,
    error: albumsError,
    refetch: refetchAlbums,
    isStale: albumsIsStale,
  } = useCachedFirebaseQuery<Album>(albumsQuery, {
    cacheKey: "user_albums_for_modal",
    cacheTtl: CACHE_CONFIGS.albums.ttl,
    enableRealtime: true,
    staleWhileRevalidate: true,
  });

  // Filter albums that don't already contain this photo
  const availableAlbums =
    allAlbums?.filter((album) => !photo.albums?.includes(album.id)) || [];

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setSelectedAlbum("");
      setShowCreateAlbum(false);
      setNewAlbumTitle("");
      setNewAlbumDescription("");
    }
  }, [isOpen]);

  // Handle creating a new album with the photo
  const handleCreateNewAlbum = useCallback(async () => {
    if (!newAlbumTitle.trim() || !user) return;

    setIsCreatingAlbum(true);
    try {
      // Create the new album
      const newAlbumData = {
        title: newAlbumTitle.trim(),
        description: newAlbumDescription.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email || "Unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublic: false,
        photoCount: 1, // Will have this photo
        coverPhoto: photo.url, // Use this photo as cover
      };

      const newAlbumRef = await addDoc(collection(db, "albums"), newAlbumData);

      // Add the photo to the new album (using your albums array structure)
      const photoRef = doc(db, "photos", photo.id);
      await updateDoc(photoRef, {
        albums: arrayUnion(newAlbumRef.id),
        updatedAt: serverTimestamp(),
      });

      // INVALIDATE CACHE after successful album creation
      if (user) {
        CacheInvalidationManager.invalidateForAction("album-create", user.uid);
        CacheInvalidationManager.invalidateForAction("photo-update", user.uid);
      }

      toast.success(`Photo added to new album "${newAlbumTitle}"`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error creating album:", error);
      toast.error("Failed to create album. Please try again.");
    } finally {
      setIsCreatingAlbum(false);
    }
  }, [newAlbumTitle, newAlbumDescription, user, photo, onSuccess, onClose]);

  // Handle adding photo to existing album
  const handleAddToExistingAlbum = useCallback(async () => {
    if (!selectedAlbum || !user) return;

    setIsSubmitting(true);
    try {
      const selectedAlbumData = availableAlbums.find(
        (a) => a.id === selectedAlbum
      );

      // Update the photo document to include the album (using your albums array structure)
      const photoRef = doc(db, "photos", photo.id);
      await updateDoc(photoRef, {
        albums: arrayUnion(selectedAlbum),
        updatedAt: serverTimestamp(),
      });

      // Update the album's photo count and updated timestamp
      const albumRef = doc(db, "albums", selectedAlbum);
      await updateDoc(albumRef, {
        photoCount: (selectedAlbumData?.photoCount || 0) + 1,
        updatedAt: serverTimestamp(),
        // Update cover photo if album is empty
        ...((!selectedAlbumData?.coverPhoto ||
          selectedAlbumData.photoCount === 0) && {
          coverPhoto: photo.url,
        }),
      });

      // INVALIDATE CACHE after successful addition
      if (user) {
        CacheInvalidationManager.invalidateForAction("photo-update", user.uid);
        CacheInvalidationManager.invalidateForAction("album-update", user.uid);
      }

      toast.success(`Photo added to "${selectedAlbumData?.title}"`);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error adding photo to album:", error);
      toast.error("Failed to add photo to album. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [selectedAlbum, user, availableAlbums, photo, onSuccess, onClose]);

  // Handle refresh if there's an error
  const handleRefresh = useCallback(() => {
    if (user) {
      CacheInvalidationManager.invalidateForAction("albums-refresh", user.uid);
      refetchAlbums();
    }
  }, [user, refetchAlbums]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {showCreateAlbum ? "Create New Album" : "Add Photo to Album"}
          {albumsIsStale && (
            <span className="text-xs text-yellow-500 ml-2">(updating...)</span>
          )}
        </h3>

        {/* Photo Preview */}
        <div className="flex items-center mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="relative w-16 h-16 mr-3 flex-shrink-0">
            <SafeImage
              src={photo.url}
              alt={photo.title || "Photo"}
              className="w-full h-full object-cover rounded"
              loading="lazy"
            />
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {photo.title || "Untitled Photo"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {photo.albums?.length
                ? `Already in ${photo.albums.length} album(s)`
                : "Not in any albums"}
            </p>
          </div>
        </div>

        {showCreateAlbum ? (
          /* Create New Album Form */
          <div className="space-y-4">
            <div>
              <label
                htmlFor="album-title"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Album Title *
              </label>
              <input
                id="album-title"
                type="text"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder="Enter album title..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                maxLength={100}
                disabled={isCreatingAlbum}
              />
            </div>

            <div>
              <label
                htmlFor="album-description"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="album-description"
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
                placeholder="Describe your album..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                maxLength={500}
                disabled={isCreatingAlbum}
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This photo will be added to the new album
                and used as the cover photo.
              </p>
            </div>

            {/* Create Album Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setShowCreateAlbum(false)}
                disabled={isCreatingAlbum}
                className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm disabled:opacity-50"
              >
                ← Back to album selection
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isCreatingAlbum}
                  className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  onClick={handleCreateNewAlbum}
                  disabled={!newAlbumTitle.trim() || isCreatingAlbum}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                >
                  {isCreatingAlbum ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Creating...
                    </div>
                  ) : (
                    "Create Album"
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Existing Album Selection */
          <>
            {/* Error handling */}
            {albumsError && (
              <div className="mb-4 bg-red-100 dark:bg-red-900/20 border border-red-400 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded relative">
                <span className="block sm:inline">
                  Error loading albums: {albumsError}
                </span>
                <button
                  onClick={handleRefresh}
                  className="ml-4 underline hover:no-underline"
                >
                  Try again
                </button>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner message="Loading albums..." />
              </div>
            ) : (
              <>
                {/* Create New Album Option */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowCreateAlbum(true)}
                    disabled={isSubmitting}
                    className="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors group disabled:opacity-50"
                  >
                    <div className="flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-gray-400 dark:text-gray-500 group-hover:text-blue-500 mr-2"
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
                      <span className="text-gray-600 dark:text-gray-300 group-hover:text-blue-700 dark:group-hover:text-blue-300 font-medium">
                        Create New Album
                      </span>
                    </div>
                  </button>
                </div>

                {availableAlbums.length > 0 ? (
                  <>
                    {/* Divider */}
                    <div className="relative mb-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          or add to existing album
                        </span>
                      </div>
                    </div>

                    {/* Album Selection */}
                    <div className="mb-6">
                      <label
                        htmlFor="album-select"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                      >
                        Select Existing Album
                      </label>
                      <select
                        id="album-select"
                        value={selectedAlbum}
                        onChange={(e) => setSelectedAlbum(e.target.value)}
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
                      >
                        <option value="">Choose an album...</option>
                        {availableAlbums.map((album) => (
                          <option key={album.id} value={album.id}>
                            {album.title} ({album.photoCount || 0} photos)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
                      >
                        Cancel
                      </button>

                      <button
                        onClick={handleAddToExistingAlbum}
                        disabled={!selectedAlbum || isSubmitting}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Adding...
                          </div>
                        ) : (
                          "Add to Album"
                        )}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      No available albums found.
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
                      {photo.albums?.length
                        ? "This photo may already be in all your albums. Create a new album to organize your photos differently!"
                        : "Create your first album to organize your photos!"}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={() => !isSubmitting && !isCreatingAlbum && onClose()}
      />
    </div>
  );
}
