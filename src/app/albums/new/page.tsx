"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { Album } from "@/types";
import LoadingSpinner from "@/components/LoadingSpinner";
import Image from "next/image";

export default function NewAlbumPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [albumData, setAlbumData] = useState({
    title: "",
    description: "",
    isPublic: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  // Cover photo selection states
  const [photos, setPhotos] = useState<
    Array<{ id: string; [key: string]: any }>
  >([]);
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState("");
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserPhotos();
    }
  }, [user]);

  const fetchUserPhotos = async () => {
    setIsLoadingPhotos(true);
    try {
      const photosQuery = query(
        collection(db, "photos"),
        orderBy("createdAt", "desc")
      );
      const photoSnapshot = await getDocs(photosQuery);
      const photosData = photoSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setPhotos(photosData);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked =
      type === "checkbox" ? (e.target as HTMLInputElement).checked : undefined;

    setAlbumData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const createAlbum = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      setError("You must be logged in to create an album");
      return;
    }

    if (!albumData.title.trim()) {
      setError("Album title is required");
      return;
    }

    setIsCreating(true);
    setError("");

    try {
      const albumDoc = await addDoc(collection(db, "albums"), {
        title: albumData.title.trim(),
        description: albumData.description.trim(),
        isPublic: albumData.isPublic,
        createdBy: user.uid,
        createdByName: user.displayName || user.email,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        photos: [],
        photoCount: 0,
        coverPhoto: selectedCoverPhoto || null, // Include selected cover photo
        sharedWith: [],
        tags: [],
      });

      // Redirect to the new album
      router.push(`/albums/${albumDoc.id}`);
    } catch (error: unknown) {
      console.error("Error creating album:", error);
      setError("Failed to create album. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };

  // Redirect if not authenticated
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/albums" className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-gray-500 dark:text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                <span className="text-gray-500 dark:text-gray-400">
                  Back to Albums
                </span>
              </Link>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                FPS
              </span>
            </div>

            <div className="flex items-center gap-4">
              <ThemeToggle />
              <Link
                href="/dashboard"
                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 text-sm font-medium transition-colors"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Create New Album
            </h1>
            <p className="text-gray-600">
              Organize your photos into a beautiful album
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Album Creation Form */}
          <form onSubmit={createAlbum} className="space-y-6">
            {/* Album Title */}
            <div>
              <label
                htmlFor="title"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Album Title *
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={albumData.title}
                onChange={handleInputChange}
                placeholder="e.g., Summer Vacation 2024"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isCreating}
                required
                maxLength={100}
              />
            </div>

            {/* Album Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Description (Optional)
              </label>
              <textarea
                id="description"
                name="description"
                value={albumData.description}
                onChange={handleInputChange}
                placeholder="Tell us about this album..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isCreating}
                maxLength={500}
              />
            </div>

            {/* Cover Photo Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Photo (Optional)
              </label>
              <p className="text-sm text-gray-500 mb-4">
                Choose a photo to represent this album. You can change this
                later.
              </p>

              {isLoadingPhotos ? (
                <LoadingSpinner message="Loading your photos..." />
              ) : photos.length > 0 ? (
                <>
                  {/* No Cover Option */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCoverPhoto("")}
                      disabled={isCreating}
                      className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
                        selectedCoverPhoto === ""
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-center">
                        <svg
                          className="h-8 w-8 text-gray-400 mr-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span
                          className={`font-medium ${
                            selectedCoverPhoto === ""
                              ? "text-blue-700"
                              : "text-gray-600"
                          }`}
                        >
                          No cover photo
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Photos Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedCoverPhoto === photo.url
                            ? "border-blue-500 ring-2 ring-blue-200"
                            : "border-transparent hover:border-gray-300"
                        } ${isCreating ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() =>
                          !isCreating && setSelectedCoverPhoto(photo.url)
                        }
                      >
                        <Image 
                          src={photo.url}
                          alt={photo.title || "Photo"}
                          fill
                          sizes="100px"
                          className="object-cover"
                          loading="lazy"
                          quality={75}
                        />

                        {/* Selection indicator */}
                        {selectedCoverPhoto === photo.url && (
                          <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
                            <div className="bg-blue-600 text-white rounded-full p-1">
                              <svg
                                className="h-3 w-3"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400 mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  <p className="text-gray-500 mb-2">No photos available</p>
                  <p className="text-sm text-gray-400">
                    Upload some photos first to select a cover
                  </p>
                </div>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">
                Privacy Settings
              </h3>

              <div className="space-y-3">
                <label className="flex items-start">
                  <input
                    type="checkbox"
                    name="isPublic"
                    checked={albumData.isPublic}
                    onChange={handleInputChange}
                    disabled={isCreating}
                    className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <span className="text-sm font-medium text-gray-700">
                      Make this album public
                    </span>
                    <p className="text-xs text-gray-500 mt-1">
                      Public albums can be viewed by all family members. Private
                      albums are only visible to you unless shared.
                    </p>
                  </div>
                </label>
              </div>
            </div>

            {/* Album Preview */}
            <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-900 mb-4">
                Album Preview
              </h3>

              <div className="flex items-center p-4 bg-white rounded-lg border border-gray-200">
                <div className="w-16 h-16 rounded-lg bg-gray-200 flex items-center justify-center mr-4 overflow-hidden">
                  {selectedCoverPhoto ? (
                    <Image 
                      src={selectedCoverPhoto}
                      alt="Cover preview"
                      width={64}
                      height={64}
                      className="object-cover rounded-lg"
                      loading="lazy"
                    />
                  ) : (
                    <svg
                      className="h-8 w-8 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {albumData.title || "Your Album Title"}
                  </h4>
                  <p className="text-sm text-gray-500 mt-1">
                    {albumData.description ||
                      "Album description will appear here"}
                  </p>
                  <div className="flex items-center mt-2 text-xs text-gray-400">
                    <span>0 photos</span>
                    <span className="mx-2">•</span>
                    <span>{albumData.isPublic ? "Public" : "Private"}</span>
                    <span className="mx-2">•</span>
                    <span>Created by {user?.displayName || user?.email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6">
              <Link
                href="/albums"
                className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={isCreating || !albumData.title.trim()}
                className={`px-8 py-3 rounded-lg font-medium transition-colors ${
                  isCreating || !albumData.title.trim()
                    ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 text-white"
                }`}
              >
                {isCreating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  "Create Album"
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Next Steps Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-sm font-medium text-blue-900 mb-2">
            What happens next?
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • Your album will be created and you&apos;ll be taken to the album
              page
            </li>
            <li>
              • You can add photos by uploading them or selecting them from
              existing photos
            </li>
            <li>• You can share the album with family members</li>
            <li>• You can edit the album details anytime</li>
          </ul>
        </div>
      </main>
    </div>
  );
}
