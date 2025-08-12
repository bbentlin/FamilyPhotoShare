"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  priority?: boolean; // <-- ensure prop exists
  width?: number;
  height?: number;
};

function isEdgeUA() {
  if (typeof navigator === "undefined") return false;
  return /Edg\//.test(navigator.userAgent);
}

export default function PhotoImage(props: Props) { 
  const { src, alt, className, fill, sizes, priority, width, height } = props;
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
      src={src}
      alt={alt}
      className={`object-cover ${className ?? ""}`}
      fill={fill}
      sizes={sizes}
      priority={priority} // <-- forward to Next/Image
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      unoptimized={attempt === 1}
      placeholder="empty"
      onError={() => setAttempt((a) => (a === 0 ? 1 : 2))}
    />
  );
}
