"use client";

import React from "react";
import { Photo } from "@/types";
import PhotoImage from "./PhotoImage";

interface VirtualPhotoItemProps {
  photo: Photo;
  onClick: () => void;
  onAddToAlbum: () => void;
  style?: React.CSSProperties;
}

const VirtualPhotoItem = React.memo(function VirtualPhotoItem({
  photo,
  onClick,
  onAddToAlbum,
  style,
}: VirtualPhotoItemProps) {
  // This is the new, robust handler for the "Add to Album" button.
  const handleAddToAlbumClick = (e: React.MouseEvent) => {
    // ✅ This is the fix. It stops the click event from bubbling up to the parent div.
    e.stopPropagation();
    onAddToAlbum();
  };

  return (
    <div
      className="group relative aspect-square bg-gray-100 dark:bg-gray-700"
      style={style}
    >
      {/* This div is the clickable area for opening the photo modal. */}
      <div
        className="absolute inset-0 w-full h-full cursor-pointer"
        onClick={onClick}
      >
        {photo.url ? (
          <PhotoImage
            src={photo.url}
            alt={photo.title || "Photo"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-600" />
        )}
        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />
      </div>

      {/* This button now uses the new handler. */}
      <button
        onClick={handleAddToAlbumClick}
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
    </div>
  );
});

export default VirtualPhotoItem;
