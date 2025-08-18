import type { NextConfig } from "next";

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,

  images: {
    remotePatterns: [
      // Firebase Storage JSON API
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: "/v0/b/**",
      },
      // Optional: XML API host (sometimes used)
      {
        protocol: "https",
        hostname: "storage.googleapis.com",
        pathname: "/**",
      },
    ],
    // Force WebP only; avoid AVIF on Edge
    formats: ["image/webp"],
    // TEMP: if you want to quickly verify Edge works, uncomment next line
    // unoptimized: true,
  },
};

export default nextConfig;
