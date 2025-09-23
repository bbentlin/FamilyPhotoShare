"use client";

import { useState } from "react";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Album, Photo } from "@/types";
import SafeImage from "./SafeImage";

interface SetCoverPhotoModalProps {
  album: Album;
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelected: (photoId: string) => void; // photoId here is actually URL per your usage
}

export default function SetCoverPhotoModal({
  album,
  photos,
  isOpen,
  onClose,
  onPhotoSelected,
}: SetCoverPhotoModalProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<string>(
    album?.coverPhoto || ""
  );
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateCover = async () => {
    if (!album) return;

    setIsUpdating(true);
    try {
      const albumRef = doc(db, "albums", album.id);
      await updateDoc(albumRef, {
        coverPhoto: selectedPhoto || null,
        updatedAt: serverTimestamp(),
      });

      onPhotoSelected(selectedPhoto);
      onClose();
    } catch (error) {
      console.error("Error updating cover photo:", error);
      alert("Failed to update cover photo. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Set Cover Photo for &quot;{album?.title}&quot;
        </h3>

        <p className="text-gray-600 mb-6">
          Choose a cover photo for this album
        </p>

        {/* No Cover Option */}
        <div className="mb-6">
          <button
            onClick={() => setSelectedPhoto("")}
            className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
              selectedPhoto === ""
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <div className="flex items-center justify-center">
              <span
                className={`font-medium ${
                  selectedPhoto === "" ? "text-blue-700" : "text-gray-600"
                }`}
              >
                No Cover Photo
              </span>
            </div>
          </button>
        </div>

        {photos.length > 0 ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
            {photos.map((photo, i) => (
              <button
                key={photo.id}
                type="button"
                className={`group relative aspect-square min-h-[120px] rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                  selectedPhoto === photo.url
                    ? "border-blue-500 ring-2 ring-blue-200"
                    : "border-transparent hover:border-gray-300"
                }`}
                onClick={() => setSelectedPhoto(photo.url)}
              >
                <SafeImage
                  src={photo.url}
                  alt={photo.title || "Photo"}
                  className="w-full h-full object-cover"
                  loading={i < 6 ? "eager" : "lazy"}
                />
                {selectedPhoto === photo.url && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-blue-600 text-white rounded-full p-1">
                      ✓
                    </div>
                  </div>
                )}
                {photo.url === album?.coverPhoto && (
                  <div className="absolute top-1 left-1 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                    Current
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            No photos available.
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isUpdating}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdateCover}
            disabled={selectedPhoto === album?.coverPhoto || isUpdating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {isUpdating
              ? "Updating..."
              : selectedPhoto === ""
              ? "Remove Cover"
              : "Set as Cover"}
          </button>
        </div>
      </div>

      <div
        className="absolute inset-0 -z-10"
        onClick={() => !isUpdating && onClose()}
      />
    </div>
  );
}
