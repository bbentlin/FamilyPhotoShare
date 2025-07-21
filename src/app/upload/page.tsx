"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  collection,
  getDocs,
  query,
  addDoc,
  serverTimestamp,
  orderBy,
} from "firebase/firestore";
import { storage, db } from "@/lib/firebase";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import LoadingSpinner from "@/components/LoadingSpinner";
import SafeImage from "@/components/SafeImage";

interface PhotoFile {
  file: File;
  preview: string;
  title: string;
  description: string;
}

export default function UploadPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [selectedFiles, setSelectedFiles] = useState<PhotoFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: number;
  }>({});
  const [albumTitle, setAlbumTitle] = useState("");
  const [error, setError] = useState("");
  const [albums, setAlbums] = useState<
    Array<{ id: string; [key: string]: any }>
  >([]);
  const [selectedAlbum, setSelectedAlbum] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    async function fetchAlbums() {
      if (!user || !db) return;

      try {
        const albumsQuery = query(
          collection(db, "albums"),
          orderBy("updatedAt", "desc")
        );
        const albumSnapshot = await getDocs(albumsQuery);
        const albumsData = albumSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setAlbums(albumsData);
      } catch (error: unknown) {
        console.error("Error fetching albums:", error);
        setAlbums([]);
      }
    }

    fetchAlbums();
  }, [user]);

  // Redirect handling
  useEffect(() => {
    if (isMounted && !user) {
      router.push("/login");
    }
  }, [user, router, isMounted]);

  useEffect(() => {
    return () => {
      selectedFiles.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, []);

  // Early return for mounting
  if (!isMounted) {
    return <LoadingSpinner message="Loading..." />;
  }

  // Early return for authentication
  if (!user) {
    return <LoadingSpinner message="Redirecting to login..." />; 
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Filter for image files only
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));

    if (imageFiles.length !== files.length) {
      setError("Only image files are allowed");
      return;
    }

    // Create preview objects
    const newFiles: PhotoFile[] = imageFiles.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
      title: file.name.split(".")[0], // Remove extension
      description: "",
    }));

    setSelectedFiles((prev) => [...prev, ...newFiles]);
    setError("");
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => {
      // Clean up the preview URL
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateFileMetadata = (
    index: number,
    field: "title" | "description",
    value: string
  ) => {
    setSelectedFiles((prev) =>
      prev.map((file, i) => (i === index ? { ...file, [field]: value } : file))
    );
  };

  const uploadFiles = async () => {
    if (!user || selectedFiles.length === 0) return;

    setIsUploading(true);
    setError("");

    try {
      const uploadedPhotos = [];
      const albumArray = selectedAlbum ? [selectedAlbum] : [];

      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const photoFile = selectedFiles[i];
        const fileId = `${Date.now()}_${i}_${photoFile.file.name}`;

        // Create storage reference
        const storageRef = ref(storage, `photos/${user.uid}/${fileId}`);

        // Upload file
        setUploadProgress((prev) => ({ ...prev, [fileId]: 0 }));

        const snapshot = await uploadBytes(storageRef, photoFile.file);
        const downloadURL = await getDownloadURL(snapshot.ref);

        //Create document in Firestore
        const photoDoc = await addDoc(collection(db, "photos"), {
          title: photoFile.title || "Untitled Photo",
          description: photoFile.description || "",
          url: downloadURL,
          fileName: photoFile.file.name,
          fileSize: photoFile.file.size,
          uploadedBy: user.uid,
          uploadedByName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          albums: albumArray,
          albumId: null, // I'll implement albums later
          sharedWith: [], // Array of user IDs who can view this photo
          tags: [],
          likes: [],
          comments: [],
        });

        uploadedPhotos.push({
          id: photoDoc.id,
          url: downloadURL,
          title: photoFile.title,
        });

        setUploadProgress((prev) => ({ ...prev, [fileId]: 100 }));
      }

      // If album title is provided, create an album
      if (albumTitle.trim()) {
        await addDoc(collection(db, "albums"), {
          title: albumTitle,
          description: "",
          createdBy: user.uid,
          createdByName: user.displayName || user.email,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          photos: uploadedPhotos.map((photo) => photo.id),
          photoCount: uploadedPhotos.length,
          coverPhoto: uploadedPhotos[0]?.url || null,
          sharedWith: [],
          isPublic: false,
        });
      }

      // Clean up preview URLs
      selectedFiles.forEach((file) => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });

      // Clear selected files
      setSelectedFiles([]);

      // Redirect to dashboard
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Upload error:", error);
      setError("Failed to upload photos. Please try again.");
    } finally {
      setIsUploading(false);
      setUploadProgress({});
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
            Upload Photos
          </h1>

          {/* Album Title Input */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Album Information
            </h2>
            <div>
              <label
                htmlFor="albumTitle"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Album Title
              </label>
              <input
                type="text"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder="e.g., Summer Vacation 2024"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                disabled={isUploading}
              />
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Leave empty to upload individual photos without creating an album
              </p>
            </div>
          </div>

          {/* Album Selection */}
          {albums.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Add to Existing Album
              </h2>
              <div>
                <label
                  htmlFor="album"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Select Album (Optional)
                </label>
                <select
                  id="album"
                  value={selectedAlbum}
                  onChange={(e) => setSelectedAlbum(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  disabled={isUploading}
                >
                  <option value="">No Album</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  You can also add photos to album later
                </p>
              </div>
            </div>
          )}

          {/* File Upload Area */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Select Photos
            </h2>

            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <svg
                className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="text-xl text-gray-900 dark:text-white mb-2">
                Drop photos here or click to browse
              </div>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Support for JPG, PNG, GIF files
              </p>

              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
                disabled={isUploading}
              />
              <label
                htmlFor="file-upload"
                className={`cursor-pointer inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  isUploading
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                Choose Files
              </label>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 mb-6">
              <p className="text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Selected Photos ({selectedFiles.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedFiles.map((photoFile, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
                  >
                    <div 
                      className="relative h-48"
                      style={{ touchAction: 'manipulation' }}
                    >
                      <SafeImage 
                        src={photoFile.preview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                        style={{
                          minHeight: '44px',
                          minWidth: '44px',
                          touchAction: 'manipulation'
                        }}
                        disabled={isUploading}
                      >
                        x
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={photoFile.title}
                          onChange={(e) =>
                            updateFileMetadata(index, "title", e.target.value)
                          }
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          disabled={isUploading}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          value={photoFile.description}
                          onChange={(e) =>
                            updateFileMetadata(
                              index,
                              "description",
                              e.target.value
                            )
                          }
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          disabled={isUploading}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Button */}
          {selectedFiles.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Ready to upload {selectedFiles.length} photo
                    {selectedFiles.length > 1 ? "s" : ""}
                  </p>
                  {albumTitle && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Will be added to album: &quot;{albumTitle}&quot;
                    </p>
                  )}
                  {selectedAlbum && albums.find(a => a.id === selectedAlbum) && (
                    <p>
                      Will be added to: &quot;{albums.find(a => a.id === selectedAlbum)?.title}&quot;
                    </p>
                  )}
                </div>

                <button
                  onClick={uploadFiles}
                  disabled={isUploading}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    isUploading
                      ? "bg-gray-400 cursor-not-allowed text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {isUploading ? "Uploading..." : "Upload Photos"}
                </button>
              </div>

              {/* Upload Progress */}
              {isUploading && (
                <div className="mt-4">
                  <LoadingSpinner message="Uploading photos..." />
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mt-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${
                          Object.keys(uploadProgress).length > 0
                            ? (Object.values(uploadProgress).reduce((a, b) => a + b, 0) /
                              selectedFiles.length)
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
