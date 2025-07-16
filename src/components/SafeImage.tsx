"use client"

import { useState } from "react";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: (e?: React.MouseEvent | React.TouchEvent) => void;
  loading?: "lazy" | "eager";
  quality?: number;
  priority?: boolean;
  onLoad?: () => void;
  onError?: () => void;
}

export default function SafeImage({
  src,
  alt,
  className = "",
  onClick,
  loading = "lazy",
  quality = 75,
  priority = false,
  onLoad,
  onError,
}: SafeImageProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  const handleLoad = () => {
    setImageLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setImageError(true);
    onError?.();
  };

  const handleClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (onClick) {
      e.preventDefault();
      e.stopPropagation();
      onClick(e);
    }
  };

  if (imageError) {
    return (
      <div 
        className={`bg-gray-200 dark:bg-gray-700 flex items-center justify-center ${className}`}
        onClick={onClick ? handleClick : undefined}
        onTouchEnd={onClick ? handleTouchEnd : undefined}
        style={{ touchAction: onClick ? 'manipulation' : 'auto'}}
      >
        <svg
          className="h-8 w-8 text-gray-400"
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
    );
  }

  return (
    <div className="relative w-full h-full">
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse rounded-lg" />
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
        onLoad={handleLoad}
        onError={handleError}
        onClick={onClick ? handleClick : undefined}
        onTouchEnd={onClick ? handleTouchEnd : undefined}
        loading={loading}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          touchAction: onClick ? 'manipulation' : 'auto',
          cursor: onClick ? 'pointer' : 'default',
        }} 
      />
    </div>
  );
}