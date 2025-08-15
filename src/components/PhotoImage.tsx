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
  loading?: "eager" | "lazy";
};

function isWindowsEdge() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Edg\//.test(ua) && /Windows NT/.test(ua);
}

export default function PhotoImage(props: Props) {
  const { src, alt, className, fill, sizes, priority, width, height, loading } =
    props;

  // Hard-bypass Next/Image on Edge (Windows) — use native <img>
  if (isWindowsEdge()) {
    const style = fill
      ? ({
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          display: "block",
        } as const)
      : ({
          width: width ?? "100%",
          height: height ?? "100%",
          display: "block",
        } as const);

    return (
      <img
        src={src}
        alt={alt}
        className={`object-cover ${className ?? ""}`}
        style={style}
        // Avoid any lazy semantics; hint high priority for above-the-fold
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        crossOrigin="anonymous"
        referrerPolicy="no-referrer-when-downgrade"
      />
    );
  }

  // Non-Windows-Edge path (keep current behavior)
  // 0 = optimized, 1 = unoptimized, 2 = native <img> fallback
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);

  useEffect(() => {
    // Prefer unoptimized on Edge (non-Windows) to avoid IO quirks
    setAttempt(/Edg\//.test(navigator.userAgent) ? 1 : 0);
  }, [src]);

  const effectiveLoading: "eager" | "lazy" | undefined = loading;
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
        loading={effectiveLoading ?? "eager"}
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
      loading={effectiveLoading}
      fetchPriority={effectiveFetchPriority}
      decoding="async"
      onError={() => setAttempt((a) => (a === 0 ? 1 : 2))}
    />
  );
}
