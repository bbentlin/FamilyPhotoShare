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

  // Debug logging
  useEffect(() => {
    console.log("HomePage render:", {
      user: !!user,
      loading,
      userEmail: user?.email,
      timestamp: new Date().toISOString(),
    });
  }, [user, loading]);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    // When loading is finished, if there is a user, redirect to the dashboard.
    if (!loading && user) {
      console.log("Redirecting to dashboard...", user.email);
      router.push("/dashboard"); // Use push instead of replace
    }
  }, [user, loading, router]);

  // While loading, show a spinner.
  if (loading) {
    console.log("HomePage showing loading...");
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // If not loading and no user, show the landing page.
  if (!user) {
    console.log("Showing landing page...");

    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-6">
            Welcome to Family Photo Share
          </h1>
          <div className="space-x-4">
            <Link
              href="/login"
              className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Sign In
            </Link>
            <Link
              href="/signup"
              className="inline-block px-6 py-3 border border-blue-600 text-blue-600 font-medium rounded-lg hover:bg-blue-50"
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
