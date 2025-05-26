"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isUpload = pathname?.startsWith("/upload");
  const isAlbums = pathname?.startsWith("/albums");
  const isPhotos = pathname?.startsWith("/photos");

  if (isDashboard || isUpload || isAlbums || isPhotos) {
    return null;
  }

  return <Navbar />;
}