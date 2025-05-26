"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    return pathname === path;
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Failed to log out", error);
    }
  };

  return (
    <nav className="bg-white shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="flex items-center gap-2">
                <div className="relative h-10 w-10">
                  <Image
                    src="/familylogo.png"
                    alt="Family logo"
                    fill
                    sizes="40px"
                    className="object-contain"
                  />
                </div>
                <span className="text-xl font-bold text-blue-600">
                  FPS
                </span>
              </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {user ? (
                <>
                  <Link
                    href="/dashboard"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/dashboard")
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/photos"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/photos")
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Photos
                  </Link>
                  <Link
                    href="/albums"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/albums")
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Albums
                  </Link>
                  <Link
                    href="/family"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/family")
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Family
                  </Link>
                  <Link
                    href="/settings"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/settings")
                      ? "text-blue-600 bg-blue"
                      : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                      Settings
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/login")
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className={`px-3 py-2 rounded-md text-sm font-medium ${
                      isActive("/signup")
                        ? "text-blue-600 bg-blue-50"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
          <div className="hidden sm:flex sm:items-center">
            {user ? (
              <div className="flex items-center">
                <Link
                  href="/upload"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Upload Photos
                </Link>
                <div className="ml-3 relative">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium">
                      {user.displayName?.[0] ||
                        user.email?.[0]?.toUpperCase() ||
                        "U"}
                    </div>
                    <button
                      onClick={handleLogout}
                      className="text-sm text-gray-700 hover:text-blue-600"
                    >
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <Link
                  href="/signup"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Get Started
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500"
              aria-expanded="false"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <span className="sr-only">Open main menu</span>
              {/* Icon when menu is closed */}
              {!isMenuOpen ? (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              ) : (
                <svg
                  className="block h-6 w-6"
                  xmlns="http://www.w3.org/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu, toggle based on menu state */}
      <div className={`${isMenuOpen ? "block" : "hidden"} sm:hidden`}>
        <div className="pt-2 pb-3 space-y-1">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/dashboard")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/photos"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/photos")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Photos
              </Link>
              <Link
                href="/albums"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/albums")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Albums
              </Link>
              <Link
                href="/family"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/family")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Family
              </Link>
              <Link
                href="/upload"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/upload")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Upload Photos
              </Link>
              <Link
                href="/settings"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/settings")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                Settings
              </Link>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50"
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/login")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Login
              </Link>
              <Link
                href="/signup"
                className={`block px-3 py-2 text-base font-medium ${
                  isActive("/signup")
                    ? "text-blue-600 bg-blue-50"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
