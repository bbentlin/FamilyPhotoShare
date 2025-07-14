"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";

export default function ConditionalNavbar() {
  const pathname = usePathname();
  
  const noNavbarPages = ['/', '/login', '/signup'];

  if (noNavbarPages.includes(pathname)) {
    return null;
  }

  return <Navbar />;
}