import React, { useCallback } from "react";
import PhotoImage from "./PhotoImage";
import { Photo } from "@/types";

interface VirtualPhotoItemProps {
  photo: Photo;
  onClick: () => void;
  onAddToAlbum: () => void;
  className?: string;
}

const VirtualPhotoItem: React.FC<VirtualPhotoItemProps> = React.memo(
  ({ photo, onClick, onAddToAlbum, className = "" }) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest("button")) {
          return;
        }
        onClick();
      },
      [onClick]
    );

    const handleAddToAlbum = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onAddToAlbum();
      },
      [onAddToAlbum]
    );

    return (
      <div
        className={`group relative aspect-square min-h-[200px] rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700 cursor-pointer ${className}`}
        onClick={handleClick}
      >
        {/* Photo / placeholder */}
        {photo.url ? (
          <PhotoImage
            src={photo.url}
            alt={photo.title || "Photo"}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            fill={true}
            sizes="250px"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
            <svg
              className="h-8 w-8 text-gray-400 dark:text-gray-300"
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

        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <p className="text-white text-sm font-medium truncate">
            {photo.title || "Untitled Photo"}
          </p>
        </div>

        {/* Add to album button */}
        <button
          onClick={handleAddToAlbum}
          className="absolute top-2 left-2 z-20 bg-black bg-opacity-70 hover:bg-opacity-90 text-white p-2 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </button>
      </div>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.photo.id === nextProps.photo.id &&
      prevProps.photo.url === nextProps.photo.url &&
      prevProps.photo.title === nextProps.photo.title
    );
  }
);

VirtualPhotoItem.displayName = "VirtualPhotoItem";

export default VirtualPhotoItem;
