"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { Photo } from "@/types";
import SafeImage from "./SafeImage";
import PhotoImage from "./PhotoImage";

const Comments = lazy(() => import("./Comments"));

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
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-lg overflow-hidden w-full max-w-4xl h-full max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
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
        <div className="flex flex-col w-full h-full">
          {/* Image area takes full height when no comments, otherwise 75% */}
          <div
            className={`relative flex items-center justify-center transition-all duration-300 w-full min-h-[400px] ${
              showComments ? "h-3/4" : "h-full"
            }`}
          >
            <PhotoImage
              src={photo.url}
              alt={photo.title || "Photo"}
              className="max-w-full max-h-full object-contain"
              fill={true}
              priority={true}
              sizes="100vw"
            />
          </div>

          {/* COMMENTS (now full-width bottom) */}
          {showComments && (
            <Suspense
              fallback={
                <div className="p-4 text-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-sm text-gray-500 mt-2">
                    Loading comments...
                  </p>
                </div>
              }
            >
              <Comments
                photoId={photo.id}
                photoOwnerId={photo.createdBy}
                photoOwnerName={photo.uploadedByName || "Unknown"}
              />
            </Suspense>
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
