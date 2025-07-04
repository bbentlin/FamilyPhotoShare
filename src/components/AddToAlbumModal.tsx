"use client";

import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  arrayUnion,
  addDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { Photo, Album } from "@/types";
import LoadingSpinner from "./LoadingSpinner";


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
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New album creation states
  const [showCreateAlbum, setShowCreateAlbum] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumDescription, setNewAlbumDescription] = useState("");
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  useEffect(() => {
    if (isOpen && user) {
      const loadAlbums = async () => {
        setIsLoading(true);
        try {
          const albumsQuery = query(
            collection(db, "albums"),
            orderBy("updatedAt", "desc")
          );
          const albumSnapshot = await getDocs(albumsQuery);
          const albumsData = albumSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Album[];

          const availableAlbums = albumsData.filter(
            (album) => !photo.albums?.includes(album.id)
          );

          setAlbums(availableAlbums);
        } catch (error) {
          console.error("Error fetching albums:", error);
        } finally {
          setIsLoading(false);
        }
      };

      loadAlbums();
    }
  }, [isOpen, user, photo.albums]);

  const handleCreateNewAlbum = async () => {
    if (!newAlbumTitle.trim() || !user) return;

    setIsCreatingAlbum(true);
    try {
      // Create the new album
      const newAlbumRef = await addDoc(collection(db, "albums"), {
        title: newAlbumTitle.trim(),
        description: newAlbumDescription.trim(),
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        createdAt: new Date(),
        updatedAt: new Date(),
        isPublic: false,
        photoCount: 1, // Will have this photo
        coverPhoto: photo.url, // Use this photo as cover
      });

      // Add the photo to the new album
      const photoRef = doc(db, "photos", photo.id);
      await updateDoc(photoRef, {
        albums: arrayUnion(newAlbumRef.id),
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error creating album:", error);
      alert("Failed to create album. Please try again.");
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleAddToExistingAlbum = async () => {
    if (!selectedAlbum) return;

    setIsSubmitting(true);
    try {
      // Update the photo document to include the album
      const photoRef = doc(db, "photos", photo.id);
      await updateDoc(photoRef, {
        albums: arrayUnion(selectedAlbum),
      });

      // Update the album's photo count
      const albumRef = doc(db, "albums", selectedAlbum);
      const selectedAlbumData = albums.find((a) => a.id === selectedAlbum);
      await updateDoc(albumRef, {
        photoCount: (selectedAlbumData?.photoCount || 0) + 1,
        updatedAt: new Date(),
      });

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error adding photo to album:", error);
      alert("Failed to add photo to album. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {showCreateAlbum ? "Create New Album" : "Add Photo to Album"}
        </h3>

        {/* Photo Preview */}
        <div className="flex items-center mb-4 p-3 bg-gray-50 rounded-lg">
          <img
            src={photo.url}
            alt={photo.title || "Photo"}
            className="w-16 h-16 object-cover rounded-lg mr-3"
          />
          <div>
            <p className="font-medium text-gray-900">
              {photo.title || "Untitled Photo"}
            </p>
            <p className="text-sm text-gray-500">
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
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Album Title *
              </label>
              <input
                id="album-title"
                type="text"
                value={newAlbumTitle}
                onChange={(e) => setNewAlbumTitle(e.target.value)}
                placeholder="Enter album title..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                maxLength={100}
              />
            </div>

            <div>
              <label
                htmlFor="album-description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="album-description"
                value={newAlbumDescription}
                onChange={(e) => setNewAlbumDescription(e.target.value)}
                placeholder="Describe your album..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                maxLength={500}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> This photo will be added to the new album
                and used as the cover photo.
              </p>
            </div>

            {/* Create Album Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setShowCreateAlbum(false)}
                disabled={isCreatingAlbum}
                className="text-gray-600 hover:text-gray-800 text-sm disabled:opacity-50"
              >
                ← Back to album selection
              </button>

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isCreatingAlbum}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
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
            {isLoading ? (
              <LoadingSpinner message="Loading albums..." />
            ) : (
              <>
                {/* Create New Album Option */}
                <div className="mb-4">
                  <button
                    onClick={() => setShowCreateAlbum(true)}
                    className="w-full p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                  >
                    <div className="flex items-center justify-center">
                      <svg
                        className="h-5 w-5 text-gray-400 group-hover:text-blue-500 mr-2"
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
                      <span className="text-gray-600 group-hover:text-blue-700 font-medium">
                        Create New Album
                      </span>
                    </div>
                  </button>
                </div>

                {albums.length > 0 ? (
                  <>
                    {/* Divider */}
                    <div className="relative mb-4">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-gray-300" />
                      </div>
                      <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-gray-500">
                          or add to existing album
                        </span>
                      </div>
                    </div>

                    {/* Album Selection */}
                    <div className="mb-6">
                      <label
                        htmlFor="album-select"
                        className="block text-sm font-medium text-gray-700 mb-2"
                      >
                        Select Existing Album
                      </label>
                      <select
                        id="album-select"
                        value={selectedAlbum}
                        onChange={(e) => setSelectedAlbum(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="">Choose an album...</option>
                        {albums.map((album) => (
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
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
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
                    <p className="text-gray-500 mb-4">
                      No available albums found.
                    </p>
                    <p className="text-sm text-gray-400 mb-4">
                      This photo may already be in all your albums. Create a new
                      album to organize your photos!
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
