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
  width?: number;
  height?: number;
  loading?: "eager" | "lazy"; // <-- add
};

function isEdgeUA() {
  if (typeof navigator === "undefined") return false;
  return /Edg\//.test(navigator.userAgent);
}

export default function PhotoImage(props: Props) {
  const { src, alt, className, fill, sizes, priority, width, height, loading } =
    props;
  // 0 = normal optimized, 1 = unoptimized, 2 = native <img>
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    // Prefer unoptimized on Edge to avoid IO/Lazy quirks
    setAttempt(isEdgeUA() ? 1 : 0);
  }, [src]);

  const effectiveLoading: "eager" | "lazy" | undefined =
    loading ?? (isEdgeUA() ? "eager" : undefined); // default eager on Edge
  const effectiveFetchPriority =
    priority || effectiveLoading === "eager" ? "high" : "auto";

  if (attempt === 2) {
    return (
      <img
        src={src}
        alt={alt}
        className={`object-cover ${className ?? ""}`}
        style={{ width: "100%", height: "100%", display: "block" }}
        crossOrigin="anonymous"
        loading={effectiveLoading ?? "eager"} // <-- don't use lazy in fallback
        decoding="async"
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
      priority={!!priority}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      unoptimized={attempt === 1}
      placeholder="empty"
      loading={effectiveLoading} // <-- ensure eager when needed
      fetchPriority={effectiveFetchPriority} // <-- boost above-the-fold
      decoding="async"
      onError={() => setAttempt((a) => (a === 0 ? 1 : 2))}
    />
  );
}
