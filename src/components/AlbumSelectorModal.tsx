"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Photo } from "@/types";
import { usePhotosWithPagination } from "@/hooks/usePhotosWithPagination";
import PhotoImage from "./PhotoImage";
import LoadingSpinner from "./LoadingSpinner";
import InfiniteScrollGrid from "./InfiniteScrollGrid";

// This is the internal photo item for the modal.
function ModalPhotoItem({
  photo,
  isSelected,
  isExisting,
  onSelect,
}: {
  photo: Photo;
  isSelected: boolean;
  isExisting: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`relative aspect-square rounded-md overflow-hidden group ${
        isExisting ? "cursor-not-allowed" : "cursor-pointer"
      }`}
    >
      <PhotoImage
        src={photo.url}
        alt={photo.title || "Photo"}
        fill
        className="object-cover"
      />
      {/* Overlays */}
      <div
        className={`absolute inset-0 transition-all duration-200 ${
          isSelected
            ? "ring-4 ring-blue-500 ring-inset bg-black/30"
            : "bg-black/0 group-hover:bg-black/20"
        } ${isExisting ? "bg-black/50" : ""}`}
      />
      {/* Checkmark for selected */}
      {isSelected && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white pointer-events-none">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={3}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
      )}
      {/* Lock icon for existing */}
      {isExisting && (
        <div className="absolute top-2 right-2 w-6 h-6 bg-gray-700 bg-opacity-70 rounded-full flex items-center justify-center text-white pointer-events-none">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>
      )}
    </div>
  );
}

interface AlbumSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddPhotos: (photos: Photo[]) => void;
  existingPhotoIds?: string[];
}

export default function AlbumSelectorModal({
  isOpen,
  onClose,
  onAddPhotos,
  existingPhotoIds = [],
}: AlbumSelectorModalProps) {
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const {
    photos, // ✅ This is the correct variable from the hook
    loading,
    hasMore,
    loadMore,
    error,
  } = usePhotosWithPagination(30, "newest");

  useEffect(() => {
    if (isOpen) {
      setSelectedPhotos([]);
    }
  }, [isOpen]);

  const handlePhotoSelect = useCallback(
    (photo: Photo) => {
      if (existingPhotoIds.includes(photo.id)) {
        return;
      }
      setSelectedPhotos((prev) => {
        const isSelected = prev.some((p) => p.id === photo.id);
        if (isSelected) {
          return prev.filter((p) => p.id !== photo.id);
        } else {
          return [...prev, photo];
        }
      });
    },
    [existingPhotoIds]
  );

  const handleAddClick = useCallback(() => {
    if (selectedPhotos.length > 0) {
      onAddPhotos(selectedPhotos);
    }
  }, [selectedPhotos, onAddPhotos]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-4xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Select Photos to Add
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <svg
              className="w-6 h-6"
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

        <div className="flex-grow overflow-y-auto p-4">
          {/* ✅ FIX: Check `photos` variable, not `albums` */}
          {loading && (!photos || photos.length === 0) ? (
            <div className="flex items-center justify-center h-full">
              <LoadingSpinner message="Loading photos..." />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              Error: {error}
            </div>
          ) : photos && photos.length > 0 ? ( // ✅ FIX: Check `photos` variable
            <InfiniteScrollGrid
              hasMore={hasMore}
              loading={loading}
              onLoadMore={loadMore}
            >
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                {/* ✅ FIX: Map over `photos` variable */}
                {photos.map((photo) => (
                  <ModalPhotoItem
                    key={photo.id}
                    photo={photo}
                    isSelected={selectedPhotos.some((p) => p.id === photo.id)}
                    isExisting={existingPhotoIds.includes(photo.id)}
                    onSelect={() => handlePhotoSelect(photo)}
                  />
                ))}
              </div>
            </InfiniteScrollGrid>
          ) : (
            // ✅ FIX: Empty state for when there are no photos at all
            <div className="text-center py-16">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                No Photos Found
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload some photos to get started.
              </p>
              <Link
                href="/upload"
                className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload Photos
              </Link>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {selectedPhotos.length} photo{selectedPhotos.length !== 1 && "s"}{" "}
              selected
            </p>
            <button
              onClick={handleAddClick}
              disabled={selectedPhotos.length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              Add {selectedPhotos.length > 0 ? selectedPhotos.length : ""} Photo
              {selectedPhotos.length !== 1 && "s"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
