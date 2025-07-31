import React, { useState } from "react";
import Image from "next/image";

interface PhotoImageProps {
  src: string;
  alt: string;
  className: string;
  width?: number;
  height?: number;
  priority?: boolean;
  sizes?: string;
  fill?: boolean;
}

const PhotoImage: React.FC<PhotoImageProps> = ({
  src,
  alt,
  className = '',
  width = 300,
  height = 300,
  priority = false,
  sizes = '(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw',
  fill = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate a simple blur placeholder
  const generateBlurDataURL = () => {
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyb55A3dqWOh9NLJaJxNWgmGjAkjf8AoaBEoJZYFQyiL7T0rSwgzO5TTYY8bJCm2oUQXYNLT0oOFNrM0cQN3NcMTAFE9LTfnJnr9U/5K7xQN6FdO2t9BvOPV6Y7gNv4KiPwZGYhqOz/2Q==';
  };

  if (hasError) {
    return (
      <div className={`bg-gray-200 dark:bg-gray-600 flex items-center justify-center ${className}`}>
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
    );
  }

  return (
    <div className="relative">
      <Image 
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        sizes={sizes}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'  
        } ${className}`}
        placeholder="blur"
        blurDataURL={generateBlurDataURL()}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
        style={{
          objectFit: 'cover',
        }}
      />

      {/* Loading skeleton */}
      {isLoading && (
        <div className={`absolute inset-0 bg-gray-200 dark:bg-gray-700 animate-pulse ${fill ? '' : `w-[${width}px] h-[${height}px]`}`} />
      )}
    </div>
  );
};

export default PhotoImage;