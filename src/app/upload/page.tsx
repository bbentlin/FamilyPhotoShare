"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getDb, getStorage } from "@/lib/firebase";
import { toast } from "react-hot-toast";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";
import { notifyNewUploadSubscribers } from "@/lib/notifications";

// CACHING IMPORTS
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  url?: string;
  error?: string;
}

export default function UploadPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [storageError, setStorageError] = useState<string>("");

  const [db, setDb] = useState<any>(null);
  const [storage, setStorage] = useState<any>(null);

  useEffect(() => {
    setDb(getDb());
    try {
      setStorage(getStorage());
    } catch {
      // storage not available on server
    }
  }, []);

  // Client-side only check
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Check Firebase Storage availability
    const checkStorage = async () => {
      try {
        const storageInstance = getStorage();
        if (!storageInstance) {
          setStorageError("Firebase Storage is not available");
        }
      } catch (error) {
        console.error("Storage check error:", error);
        setStorageError("Storage service unavailable");
      }
    };

    checkStorage();
  }, []);

  // Show error if storage is not available
  if (storageError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">
            Storage Error
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            {storageError}
          </p>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!db) return <p>Loading DB…</p>;
  if (!storage) return <p>Loading Storage…</p>;

  // Handle file upload
  const uploadFile = useCallback(
    async (file: File, fileId: string) => {
      if (!user || !storage || !db) {
        throw new Error("User not authenticated or services not available");
      }

      try {
        // Update progress to show upload starting
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 5 } : f))
        );

        // Create storage reference
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name.replace(
          /[^a-zA-Z0-9.-]/g,
          "_"
        )}`;
        const storageRef = ref(storage, `photos/${user.uid}/${fileName}`);

        // Upload file to storage
        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 30 } : f))
        );

        const snapshot = await uploadBytes(storageRef, file);

        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 60 } : f))
        );

        // Get download URL
        const downloadURL = await getDownloadURL(snapshot.ref);

        setUploadingFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, progress: 80 } : f))
        );

        // Save photo metadata to Firestore
        const photoData = {
          url: downloadURL,
          title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
          description: "",
          uploadedBy: user.uid,
          uploadedByName: user.displayName || user.email || "Unknown",
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          size: file.size,
          type: file.type,
          fileName: fileName,
          tags: [],
          likes: [],
          comments: [],
          albumId: [],
        };

        await addDoc(collection(db, "photos"), photoData);

        // Notify subscribers (best-effort)
        notifyNewUploadSubscribers({
          uploaderId: user.uid,
          uploaderName: user.displayName || user.email || "Someone",
          photoTitle: photoData.title,
          photoUrl: downloadURL,
        });

        // INVALIDATE CACHE after successful upload
        CacheInvalidationManager.invalidateForAction("photo-upload", user.uid);

        // Update progress to complete
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, progress: 100, url: downloadURL } : f
          )
        );

        toast.success(`${file.name} uploaded successfully!`);
      } catch (error) {
        console.error("Error uploading file:", error);
        setUploadingFiles((prev) =>
          prev.map((f) =>
            f.id === fileId ? { ...f, error: "Upload failed" } : f
          )
        );
        toast.error(`Failed to upload ${file.name}`);
      }
    },
    [user, storage, db]
  );

  // Handle file selection
  const handleFiles = useCallback(
    (files: FileList) => {
      const validFiles = Array.from(files).filter((file) => {
        // Check file type
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image file`);
          return false;
        }

        // Check file size (e.g., 10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 10MB)`);
          return false;
        }

        return true;
      });

      if (validFiles.length === 0) return;

      // Add files to uploading state
      const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        progress: 0,
      }));

      setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);

      // Start uploading each file
      newUploadingFiles.forEach((uploadingFile) => {
        uploadFile(uploadingFile.file, uploadingFile.id);
      });
    },
    [uploadFile]
  );

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  // File input change handler
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  // Remove completed/failed uploads
  const removeUpload = useCallback((fileId: string) => {
    setUploadingFiles((prev) => prev.filter((f) => f.id !== fileId));
  }, []);

  // Redirect if not authenticated
  if (!loading && !user) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <LoadingSpinner message="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Upload Photos
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Share your memories with family
          </p>
        </div>

        {/* Upload Area */}
        <div className="mb-8">
          <div
            className={`relative border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
              dragActive
                ? "border-blue-400 bg-blue-50 dark:bg-blue-900/20"
                : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileInput}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />

            <div className="space-y-4">
              <div className="flex justify-center">
                <svg
                  className={`h-16 w-16 transition-colors ${
                    dragActive
                      ? "text-blue-500"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
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
              </div>

              <div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {dragActive ? "Drop your photos here!" : "Upload your photos"}
                </p>
                <p className="text-gray-500 dark:text-gray-400 mt-2">
                  Drag and drop your images here, or click to browse
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                  Supports: JPG, PNG, GIF up to 10MB each
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors font-medium"
              >
                <svg
                  className="h-5 w-5 mr-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Choose Files
              </button>
            </div>
          </div>
        </div>

        {/* Upload Progress */}
        {uploadingFiles.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Upload Progress
            </h2>

            <div className="space-y-4">
              {uploadingFiles.map((uploadingFile) => (
                <div
                  key={uploadingFile.id}
                  className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  {/* File Preview */}
                  <div className="flex-shrink-0 w-12 h-12 bg-gray-200 dark:bg-gray-600 rounded-lg overflow-hidden">
                    {uploadingFile.url ? (
                      <img
                        src={uploadingFile.url}
                        alt={uploadingFile.file.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="h-6 w-6 text-gray-400"
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
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>

                  {/* Progress */}
                  <div className="flex-1 max-w-xs">
                    {uploadingFile.error ? (
                      <div className="text-red-600 dark:text-red-400 text-sm">
                        {uploadingFile.error}
                      </div>
                    ) : uploadingFile.progress === 100 ? (
                      <div className="text-green-600 dark:text-green-400 text-sm font-medium">
                        ✓ Complete
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400">
                          <span>Uploading...</span>
                          <span>{uploadingFile.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadingFile.progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Remove Button */}
                  {(uploadingFile.progress === 100 || uploadingFile.error) && (
                    <button
                      onClick={() => removeUpload(uploadingFile.id)}
                      className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg
                        className="h-5 w-5"
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
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Clear All Button */}
            {uploadingFiles.some((f) => f.progress === 100 || f.error) && (
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() =>
                    setUploadingFiles((prev) =>
                      prev.filter((f) => f.progress !== 100 && !f.error)
                    )
                  }
                  className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Clear completed
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Actions */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            What's next?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => router.push("/photos")}
              className="p-4 text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                  <svg
                    className="h-5 w-5 text-blue-600 dark:text-blue-400"
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
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    View Photos
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    See all your uploaded photos
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push("/albums/new")}
              className="p-4 text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-green-100 dark:bg-green-900 p-2 rounded-lg">
                  <svg
                    className="h-5 w-5 text-green-600 dark:text-green-400"
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
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Create Album
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Organize photos into albums
                  </p>
                </div>
              </div>
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="p-4 text-left rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <div className="bg-purple-100 dark:bg-purple-900 p-2 rounded-lg">
                  <svg
                    className="h-5 w-5 text-purple-600 dark:text-purple-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Dashboard
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Back to main dashboard
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
