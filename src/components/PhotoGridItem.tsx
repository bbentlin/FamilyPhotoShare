"use client";

import React from "react";
import { Photo } from "@/types";
import PhotoImage from "./PhotoImage";

interface PhotoGridItemProps {
  photo: Photo;
  priority?: boolean;
  onPhotoClick: () => void;
  onAddToAlbumClick: () => void;
  dndAttributes?: React.HTMLAttributes<HTMLDivElement>;
  dndListeners?: React.HTMLAttributes<HTMLDivElement>;
  isDragging?: boolean;
  style?: React.CSSProperties; // For react-window
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
  const buttonClickRef = React.useRef(false);

  const handleAddToAlbum = (e: React.MouseEvent | React.TouchEvent) => {
    buttonClickRef.current = true;
    e.stopPropagation();
    onAddToAlbumClick();
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    if (buttonClickRef.current) {
      buttonClickRef.current = false; // Reset the flag
      return;
    }
    onPhotoClick();
  };

  return (
    <div
      style={style} // This style prop is essential for virtual grids
      className={`group relative aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 ${
        isDragging ? "opacity-50 z-50" : ""
      }`}
      onClick={handleContainerClick}
    >
      {/* Photo Image */}
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

      {/* Add to Album Button */}
      <button
        onClick={handleAddToAlbum}
        onTouchStart={handleAddToAlbum} // Handle touch events for mobile
        className="absolute top-2 left-2 z-20 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-md opacity-0 group-hover:opacity-100"
        style={{ minHeight: "44px", minWidth: "44px" }}
        title="Add to Album"
      >
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
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2H6a2 2 0 00-2 2v2M6 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </button>

      {/* Drag Handle (only rendered if dndListeners is passed) */}
      {dndListeners && (
        <div
          {...dndListeners}
          {...dndAttributes}
          className="absolute top-2 right-2 opacity-60 group-hover:opacity-100 transition-opacity cursor-move z-20 p-1"
          style={{
            touchAction: "none",
            background: "rgba(0,0,0,0.7)",
            borderRadius: 6,
            minHeight: 44,
            minWidth: 44,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
        >
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
      )}
    </div>
  );
});

export default PhotoGridItem;
