"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center justify-center min-h-screen text-center p-4">
          <Image
            src="/family-photos-logo.png"
            alt="Family Photo Share Logo"
            width={150}
            height={150}
            className="mb-6 rounded-full shadow-lg"
            priority
          />
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to Family Photo Share
          </h1>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-300 mb-8 max-w-2xl">
            The best place to privately share and cherish your family's moments,
            securely and beautifully.
          </p>
          <div className="space-x-4">
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-block px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              Sign Up
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // If user is logged in but redirect hasn't happened yet, show a loading indicator.
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  );
}