"use client";

import React from "react";
import { Photo } from "@/types";
import PhotoImage from "./PhotoImage";

interface PhotoGridItemProps {
  photo: Photo;
  priority?: boolean;
  onPhotoClick: () => void;
  onAddToAlbumClick: () => void;
  // dnd-kit props come from useSortable in the parent
  dndAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dndListeners?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  style?: React.CSSProperties;
}

const PhotoGridItem = React.memo(function PhotoGridItem({
  photo,
  priority,
  onPhotoClick,
  onAddToAlbumClick,
  dndAttributes,
  dndListeners,
  isDragging,
  style,
}: PhotoGridItemProps) {
  // Guard: ignore container clicks for a short time after Add button click
  const suppressUntilRef = React.useRef(0);

  const handleContainerClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    const target = e.target as HTMLElement;
    // Ignore clicks that originate from any button or the drag handle
    if (target.closest("button") || target.closest("[data-drag-handle]"))
      return;

    // If within suppression window, ignore
    if (Date.now() < suppressUntilRef.current) return;

    onPhotoClick();
  };

  // Stop all pointer-initiating events so they never bubble to container or dnd sensors
  const stopAll = (e: React.SyntheticEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      style={style}
      className={`group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${
        isDragging ? "opacity-50 z-50" : ""
      }`}
      onClick={handleContainerClick}
    >
      {photo.url ? (
        <PhotoImage
          src={photo.url}
          alt={photo.title || "Photo"}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          priority={priority}
        />
      ) : (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-600" />
      )}

      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />

      {/* Add to Album button */}
      <button
        type="button"
        className="photo-action absolute top-2 left-2 z-20 bg-black/70 hover:bg-black/90 text-white p-2 rounded-md opacity-0 group-hover:opacity-100"
        style={{ minHeight: 44, minWidth: 44 }}
        aria-label="Add to album"
        // Hard stop at every stage so container click never fires
        onPointerDown={stopAll}
        onMouseDown={stopAll}
        onTouchStart={stopAll}
        onClick={(e) => {
          stopAll(e);
          // Set suppression window so any stray container click is ignored
          suppressUntilRef.current = Date.now() + 500; // 0.5s guard
          onAddToAlbumClick();
        }}
      >
        <svg
          className="h-4 w-4 pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2M6 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </button>

      {/* Drag handle isolated from buttons */}
      {dndListeners && (
        <div
          data-drag-handle
          {...dndAttributes}
          {...dndListeners}
          className="absolute top-2 right-2 z-20 p-1 cursor-move"
          style={{
            touchAction: "none",
            minHeight: 44,
            minWidth: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Drag to reorder"
          onPointerDown={stopAll}
          onMouseDown={stopAll}
          onTouchStart={stopAll}
          onClick={stopAll}
        >
          <div className="bg-black/70 rounded-md p-1 pointer-events-none">
            <svg
              className="h-4 w-4 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 8h16M4 16h16"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
});

export default PhotoGridItem;
