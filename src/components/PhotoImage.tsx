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
  edgeWidth?: number; // width hint for Edge/proxy
};

const PROXY_ENABLED = process.env.NEXT_PUBLIC_USE_IMAGE_PROXY === "1";

function isWindowsEdge() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /Edg\//.test(ua) && /Windows NT/.test(ua);
}

function isFirebaseStorageUrl(u: string) {
  try {
    const url = new URL(
      u,
      typeof window !== "undefined" ? window.location.href : "http://localhost"
    );
    return (
      url.hostname.endsWith("firebasestorage.googleapis.com") ||
      url.hostname.endsWith("storage.googleapis.com")
    );
  } catch {
    return false;
  }
}

function proxied(src: string) {
  return `/api/image?u=${encodeURIComponent(src)}`;
}

export default function PhotoImage(props: Props) {
  const {
    src,
    alt,
    className,
    fill,
    sizes,
    priority,
    width,
    height,
    loading,
    edgeWidth,
  } = props;

  const useProxy =
    isWindowsEdge() && PROXY_ENABLED && isFirebaseStorageUrl(src);
  const [edgeSrc, setEdgeSrc] = useState<string | null>(null);
  const isWinEdge = isWindowsEdge();

  // Windows Edge: use native <img>, optionally proxied URL, eager load
  if (isWinEdge) {
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
          height: height ?? "auto",
          display: "block",
        } as const);

    // Heuristic: grid ~400px, modal ~1600px if not provided
    const targetW = edgeWidth ?? (fill ? 1600 : width ?? 400);
    const proxiedUrl = `/api/image?u=${encodeURIComponent(src)}&w=${Math.round(
      targetW
    )}&q=${priority ? 80 : 70}&fmt=webp`;
    const resolvedSrc = edgeSrc ?? (useProxy ? proxiedUrl : src);

    return (
      <img
        src={resolvedSrc}
        alt={alt}
        className={className}
        style={style}
        loading={loading ?? (priority ? "eager" : "lazy")}
        decoding="async"
        fetchPriority={priority ? "high" : "auto"}
        onError={() => {
          // If proxy failed, fall back to direct URL
          if (useProxy && !edgeSrc) setEdgeSrc(src);
        }}
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
