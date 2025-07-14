"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isUpload = pathname?.startsWith("/upload");
  const isAlbums = pathname?.startsWith("/albums");
  const isPhotos = pathname?.startsWith("/photos");
  const isLogin = pathname?.startsWith("/login");
  const isSignup = pathname?.startsWith("/signup");

  if (isDashboard || isUpload || isAlbums || isPhotos || isLogin || isSignup) {
    return null;
  }

  return <Navbar />;
}