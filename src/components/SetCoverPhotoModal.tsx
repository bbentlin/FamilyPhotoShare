"use client";

import { useState } from "react";
import { doc, updateDoc } from "@firebase/firestore";
import { db } from "@/lib/firebase";
import { Photo, Album } from "@/types";
import Image from "next/image";

interface SetCoverPhotoModalProps {
  album: Album;
  photos: Photo[];
  isOpen: boolean;
  onClose: () => void;
  onPhotoSelected: (photoId: string) => void;
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
        coverPhoto: selectedPhoto || null, // Allow null setting for no cover
        updatedAt: new Date(),
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

  const handlePhotoSelect = (photo: Photo) => {
    setSelectedPhoto(photo.url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Set Cover Photo for &quot;{album?.title}&quot;
        </h3>

        <p className="text-gray-600 mb-6">
          Choose a &quot;cover photo&quot; for this album
          <br />
          The selected photo will be used as the &quot;cover photo&quot; for the
          album
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
              <svg
                className="h-8 w-8 text-gray-400 mr-2"
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
          <>
            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">
                  or choose from photos
                </span>
              </div>
            </div>

            {/* Photos Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 mb-6">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className={`group relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                    selectedPhoto === photo.url
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-transparent hover:border-gray-300"
                  }`}
                  onClick={() => handlePhotoSelect(photo)}
                >
                  <Image 
                    src={photo.url}
                    alt={photo.title || "Photo"}
                    fill
                    sizes="150px"
                    className="object-cover"
                    loading="lazy"
                    quality={75}
                  />

                  {/* Selection indicator */}
                  {selectedPhoto === photo.url && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                      <div className="bg-blue-600 text-white rounded-full p-1">
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
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      </div>
                    </div>
                  )}

                  {/* Current cover indicator */}
                  {photo.url === album?.coverPhoto && (
                    <div className="absolute top-1 left-1 bg-green-600 text-white px-2 py-1 rounded text-xs font-medium">
                      Current
                    </div>
                  )}

                  {/* Photo title on hover */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-70 text-white text-xs p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    {photo.title || "Untitled Photo"}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <svg
              className="mx-auto h-12 w-12 text-gray-400 mb-4"
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

        {/* Action Buttons */}
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
            {isUpdating ? (
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Updating...
              </div>
            ) : selectedPhoto === "" ? (
              "Remove Cover"
            ) : (
              "Set as Cover"
            )}
          </button>
        </div>
      </div>

      {/* Click outside to close */}
      <div
        className="absolute inset-0 -z-10"
        onClick={() => !isUpdating && onClose()}
      />
    </div>
  );
}
