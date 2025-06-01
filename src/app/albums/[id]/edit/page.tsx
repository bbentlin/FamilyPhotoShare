"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, updateDoc, collection, getDocs, query, orderBy } from "@firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";

interface Album {
  id: string;
  title: string;
  description?: string;
  coverPhoto?: string;
  isPublic: boolean;
  createdByName: string;
  [key: string]: any;
}

export default function EditAlbumPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [album, setAlbum] = useState<Album | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState("");

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  // Cover photo selection
  const [photos, setPhotos] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [selectedCoverPhoto, setSelectedCoverPhoto] = useState("");
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const albumId = resolvedParams.id;

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }


    fetchAlbumData();
    fetchUserPhotos();
  }, [user, router, albumId]);

  const fetchAlbumData = async () => {
    try {
      const albumDoc = await getDoc(doc(db, "albums", albumId));

      if (!albumDoc.exists()) {
        router.push("/albums");
        return;
      }

      const albumData = { id: albumDoc.id, ...albumDoc.data() } as Album;
      setAlbum(albumData);
      
      // Set form values
      setTitle(albumData.title);
      setDescription(albumData.description || "");
      setIsPublic(albumData.isPublic);
      setSelectedCoverPhoto(albumData.coverPhoto || "");

    } catch (error) {
      console.error("Error fetching album:", error);
      setError("Failed to load album data");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserPhotos = async () => {
    setIsLoadingPhotos(true);
    try {
      const photosQuery = query(
        collection(db, "photos"),
        orderBy("createdAt", "desc")
      );
      const photoSnapshot = await getDocs(photosQuery);
      const photosData = photoSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPhotos(photosData);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !album) return;

    setIsUpdating(true);
    setError("");

    try {
      await updateDoc(doc(db, "albums", albumId), {
        title: title.trim(),
        description: description.trim(),
        isPublic,
        coverPhoto: selectedCoverPhoto || null,
        updatedAt: new Date()
      });

      // Redirect back to the album
      router.push(`/albums/${albumId}`);

    } catch (error) {
      console.error("Error updating album:", error);
      setError("Failed to update album. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading album...</p>
        </div>
      </div>
    );
  }

  if (!album) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Album not found</h2>
          <Link href="/albums" className="text-blue-600 hover:text-blue-800">
            ← Back to Albums
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="relative h-8 w-8">
                <Image
                  src="/familylogo.png"
                  alt="Family logo"
                  fill
                  sizes="32px"
                  className="object-contain" 
                />
              </div>
              <span className="text-xl font-bold text-blue-600">FPS</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link
              >
                ← Back to Album
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Edit Album</h1>
            <p className="text-gray-600">Update your album details and settings</p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Album Title */}
            <div>
              <label htmlFor="title" className="block tex-sm font-medium text-gray-700 mb-2">
                Album Title *
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter album title..."
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                disabled={isUpdating}
                required
                maxLength={100}
              />
            </div>

            {/* Album Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your album..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                disabled={isUpdating}
                maxLength={500} 
              />
            </div>

            {/* Cover Photo Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Cover Photo
              </label>
              <p className="text-sm text-gray-500 mb-4">
                Choose a photo to represent this album
              </p>

              {isLoadingPhotos ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <p className="text-sm text-gray-600">Loading your photos...</p>
                </div>
              ) : photos.length > 0 ? (
                <>
                  {/* No Cover Option */}
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => setSelectedCoverPhoto("")}
                      disabled={isUpdating}
                      className={`w-full p-4 border-2 border-dashed rounded-lg transition-colors ${
                        selectedCoverPhoto === ""
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-300 hover:border-gray-400"
                      } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="flex items-center justify-center">
                        <svg className="h-8 w-8 text-gray-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className={`font-medium ${
                           selectedCoverPhoto === "" ? "text-blue-700" : "text-gray-600"
                        }`}>
                          No cover photo
                        </span>
                      </div>
                    </button>
                  </div>

                  {/* Photos Grid */}
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mx-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {photos.map((photo) => (
                      <div
                        key={photo.id}
                        className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                          selectedCoverPhoto === photo.url
                            ? "border-blue-500 ring-2 ring-blue200"
                            : "border-transparent hover:border-gray-300"
                        } ${isUpdating ? "opacity-50 cursor-not-allowed" : ""}`}
                        onClick={() => !isUpdating && setSelectedCoverPhoto(photo.url)} 
                      >
                        <img 
                          src={photo.url}
                          alt={photo.title || "Photo"}
                          className="w-full h-full object-cover"
                        />

                        {/* Selection Indicator */}
                        {selectedCoverPhoto === photo.url && (
                          <div className="absolute inset-0 bg-blue-600 bg-opacity-20 flex items-center justify-center">
                            <div className="bg-blue-600 text-white rounded-full p-1">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
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
                  <svg className="mx-auto h-12 w-12 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-gray-500 mb-2">No photos available</p>
                  <p className="text-sm text-gray-400">Upload some photos first</p>
                </div>
              )}
            </div>

            {/* Privacy Settings */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-900 mb-3">Privacy Settings</h3>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={(e) => setIsPublic(e.target.checked)}
                  disabled={isUpdating}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" 
                />
                <div className="ml-3">
                  <span className="text-sm font-medium text-gray-700">Make this album public</span>
                  <p className="text-xs text-gray-500 mt-1">
                    Public albums can be viewed by all family members. Private albums are only visible to you unless shared.
                  </p>
                </div>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-6">
              <Link
                href={`/albums/${albumId}`}
                className="px-6 py-3 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors"
              >
                Cancel
              </Link>

              <button
                type="submit"
                disabled={!title.trim() || isUpdating}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isUpdating ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Updating album...
                  </div>
                ) : (
                  "Save Changes"
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}