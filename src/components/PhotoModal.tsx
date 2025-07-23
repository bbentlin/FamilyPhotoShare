"use client";

import { useState, useEffect } from "react";
import { Photo } from "@/types";
import SafeImage from "./SafeImage";
import Comments from "./Comments";

interface PhotoModalProps {
  photo: Photo;
  isOpen: boolean;
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export default function PhotoModal({
  photo,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}: PhotoModalProps) {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [showComments, setShowComments] = useState(false);

  // Reset image loaded state when photo changes
  useEffect(() => {
    setIsImageLoaded(false);
  }, [photo]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasPrevious) {
        onPrevious?.();
      } else if (e.key === "ArrowRight" && hasNext) {
        onNext?.();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, hasPrevious, hasNext, onClose, onPrevious, onNext]);

  if (!isOpen || !photo) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div className="relative max-w-7xl max-h-full w-full h-full flex items-center justify-center p-4">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
          aria-label="Close photo"
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

        {/* Comments Toggle Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowComments(!showComments);
          }}
          className="absolute top-4 left-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-2 rounded-full transition-all"
          aria-label="Toggle comments"
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        </button>

        {/* Previous Button */}
        {hasPrevious && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPrevious?.();
            }}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
            aria-label="Previous photo"
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Next Button */}
        {hasNext && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onNext?.();
            }}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white p-3 rounded-full transition-all"
            aria-label="Next photo"
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}

        {/* Layout Container */}
        <div className="flex w-full h-full">
          {/* Main Image Container */}
          <div
            className={`relative flex items-center justify-center transition-all duration-300 ${
              showComments ? "w-2/3" : "w-full"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Loading Spinner */}
            {!isImageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
              </div>
            )}

            {/* Main Image */}
            <SafeImage
              src={photo.url}
              alt={photo.title || "Photo"}
              className={`max-w-full max-h-full object-contain transition-opacity duration-300`}
              onLoad={() => setIsImageLoaded(true)}
              onError={() => setIsImageLoaded(true)}
              loading="eager"
            />
          </div>

          {/* Comments Sidebar */}
          {showComments && (
            <div
              className="w-1/3 bg-white dark:bg-gray-800 p-4 overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                  {photo.title || "Untitled Photo"}
                </h3>
                {photo.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {photo.description}
                  </p>
                )}
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {photo.createdAt instanceof Date
                    ? photo.createdAt.toLocaleDateString()
                    : photo.createdAt?.toDate?.()?.toLocaleDateString() ||
                      "Unknown date"}
                </div>
              </div>

              <Comments
                photoId={photo.id}
                photoOwnerId={(photo as any).uploadedBy}
                photoOwnerName={(photo as any).uploadedByName || "Unknown"}
              />
            </div>
          )}
        </div>

        {/* Photo Info - Only show when comments are hidden */}
        {!showComments && (
          <div className="absolute bottom-4 left-4 right-4 bg-black bg-opacity-50 text-white p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-1">
              {photo.title || "Untitled Photo"}
            </h3>
            {photo.description && (
              <p className="text-sm text-gray-300 mb-2">{photo.description}</p>
            )}
            <div className="flex items-center justify-between text-sm text-gray-400">
              <span>
                {photo.createdAt instanceof Date
                  ? photo.createdAt.toLocaleDateString()
                  : photo.createdAt?.toDate?.()?.toLocaleDateString() ||
                    "Unknown date"}
              </span>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                  Click chat icon to view comments
                </span>
                {(hasPrevious || hasNext) && (
                  <span>Use arrow keys to navigate</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
