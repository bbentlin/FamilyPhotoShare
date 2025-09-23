"use client";

import React, { useEffect, useRef, useCallback, lazy, Suspense } from "react";
import { Photo } from "@/types";
import SafeImage from "./SafeImage";
import PhotoImage from "./PhotoImage";

const Comments = lazy(() => import("./Comments"));

interface PhotoModalProps {
  photo: Photo;
  isOpen: boolean;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

const PhotoModal: React.FC<PhotoModalProps> = ({
  photo,
  isOpen,
  onClose,
  onPrevious,
  onNext,
  hasPrevious,
  hasNext,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrevious) onPrevious();
      if (event.key === "ArrowRight" && hasNext) onNext();
    },
    [onClose, onPrevious, onNext, hasPrevious, hasNext]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      const originalPath = window.location.pathname;
      const newUrl = `/photos/${photo.id}`;

      // replaceState updates the URL without adding a new entry to the browser history.
      // This stops the back button from behaving incorrectly.
      window.history.replaceState(
        { ...window.history.state, as: newUrl, url: newUrl },
        "",
        newUrl
      );

      return () => {
        document.removeEventListener("keydown", handleKeyDown);
        // On close, replace the state back to the original path.
        window.history.replaceState(
          { ...window.history.state, as: originalPath, url: originalPath },
          "",
          originalPath
        );
      };
    }
  }, [isOpen, photo.id, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col md:flex-row overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative w-full md:w-3/4 h-1/2 md:h-full bg-black flex items-center justify-center">
          <PhotoImage
            src={photo.url}
            alt={photo.title || "Photo"}
            className="object-contain"
            fill
            priority
            sizes="(max-width: 768px) 100vw, 75vw"
          />
        </div>
        <div className="w-full md:w-1/4 h-1/2 md:h-full flex flex-col p-4 overflow-y-auto">
          <h2 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">
            {photo.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Uploaded on {(photo.createdAt as any)?.toDate
              ? (photo.createdAt as any).toDate().toLocaleDateString()
              : new Date(photo.createdAt as any).toLocaleDateString()}
          </p>
          <div className="flex-grow">
            {/* COMMENTS always visible */}
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
                photoOwnerId={
                  // Prefer createdBy if present; fallback to uploadedBy
                  (photo as any).createdBy || (photo as any).uploadedBy
                }
                photoOwnerName={
                  photo.uploadedByName ||
                  (photo as any).createdByName ||
                  "Unknown"
                }
              />
            </Suspense>
          </div>
        </div>
      </div>

      {hasPrevious && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
          className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-all"
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
      {hasNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-all"
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
      <button
        onClick={onClose}
        className="absolute top-4 right-4 bg-black/50 text-white p-2 rounded-full hover:bg-black/75 transition-all"
        aria-label="Close photo modal"
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
  );
};

export default PhotoModal;
