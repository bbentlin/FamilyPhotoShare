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

function proxied(src: string) {
  return `/api/image?u=${encodeURIComponent(src)}`;
}

export default function PhotoImage(props: Props) {
  const { src, alt, className, fill, sizes, priority, width, height, loading } =
    props;

  // Windows Edge: use native <img>, proxied URL
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
        src={proxied(src)}
        alt={alt}
        className={`object-cover ${className ?? ""}`}
        style={style}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => console.error("Edge image failed", { src })}
      />
    );
  }

  // Non-Windows-Edge path (keep Next/Image, with native fallback)
  // 0 = optimized, 1 = unoptimized, 2 = native <img> fallback
  const [attempt, setAttempt] = useState<0 | 1 | 2>(0);

  useEffect(() => {
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
        // DO NOT set crossOrigin/referrerPolicy here
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
