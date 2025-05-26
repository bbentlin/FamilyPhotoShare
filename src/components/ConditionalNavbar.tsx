"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  const isDashboard = pathname.startsWith("/dashboard");
  const isUpload = pathname?.startsWith("/upload");

  if (isDashboard || isUpload) {
    return null;
  }

  return <Navbar />;
}