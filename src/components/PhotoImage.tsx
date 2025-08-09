"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean;
};

function isEdgeUA() {
  if (typeof navigator === "undefined") return false;
  return /Edg\//.test(navigator.userAgent);
}

export default function PhotoImage({
  src,
  alt,
  className = "",
  fill = false,
  sizes = "100vw",
  priority = false,
}: Props) {
  // 0 = normal optimized, 1 = unoptimized, 2 = native <img>
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    // Start unoptimized on Edge to bypass its optimization issues
    setAttempt(isEdgeUA() ? 1 : 0);
  }, [src]);

  if (attempt === 2) {
    return (
      <img
        src={src}
        alt={alt}
        className={`object-cover ${className}`}
        style={{ width: "100%", height: "100%", display: "block" }}
        crossOrigin="anonymous"
        loading="lazy"
      />
    );
  }

  return (
    <NextImage
      key={`${src}-${attempt}`}
      src={src}
      alt={alt}
      fill={fill}
      sizes={sizes}
      priority={priority}
      unoptimized={attempt === 1}
      className={`object-cover ${className}`}
      placeholder="empty"
      onError={() => setAttempt((a) => (a === 0 ? 1 : 2))}
    />
  );
}
