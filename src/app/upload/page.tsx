"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  addDoc,
  serverTimestamp,
  updateDoc,
  doc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db } from "@/lib/firebase";
import { useCachedAlbums } from "@/hooks/useCachedAlbums";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import { notifyNewUploadSubscribers } from "@/lib/notifications";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { Album } from "@/types";
import AlbumSelectorModal from "@/components/AlbumSelectorModal";

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  url?: string;
  error?: string;
  title: string;
  selectedAlbums: string[];
}

// Create a component to handle search params
function UploadPageContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const albumIdFromUrl = searchParams.get("albumId");

  const [storage, setStorage] = useState<any>(null);
  const [storageError, setStorageError] = useState("");
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [selectedFileForAlbums, setSelectedFileForAlbums] =
    useState<UploadingFile | null>(null);

  // Fetch user's albums
  const {
    albums,
    loading: albumsLoading,
    error: albumsError,
  } = useCachedAlbums(false);

  // Initialize Storage only
  useEffect(() => {
    async function initStorage() {
      if (typeof window === "undefined") return;

      try {
        const { getStorageClient } = await import("@/lib/firebase.client");
        const storageInstance = await getStorageClient();
        setStorage(storageInstance);
      } catch (e: any) {
        setStorageError(e?.message || "Storage service unavailable");
        console.error("Storage init error:", e);
      }
    }

    initStorage();
  }, []);

  const retryStorageInit = useCallback(async () => {
    setStorageError("");
    try {
      const { getStorageClient } = await import("@/lib/firebase.client");
      const storageInstance = await getStorageClient();
      setStorage(storageInstance);
    } catch (e: any) {
      setStorageError(e?.message || "Storage service unavailable");
    }
  }, []);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Auto-select album if coming from album page
  useEffect(() => {
    if (albumIdFromUrl && albums) {
      const targetAlbum = albums?.find((a: Album) => a.id === albumIdFromUrl);
      if (targetAlbum) {
        // Auto-select this album for all new uploads
        setUploadingFiles((prev) =>
          prev.map((file) => ({
            ...file,
            selectedAlbums: [
              ...(file.selectedAlbums || []),
              albumIdFromUrl,
            ].filter((id, index, arr) => arr.indexOf(id) === index),
          }))
        );
      }
    }
  }, [albumIdFromUrl, albums]);

  const uploadFile = async (uploadingFile: UploadingFile) => {
    if (!user || !storage) return;

    try {
      console.log("=== UPLOAD START ===");
      console.log("User:", user.uid);
      console.log("Selected albums:", uploadingFile.selectedAlbums);

      // 1. Upload to storage
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, progress: 25 } : f
        )
      );

      const timestamp = Date.now();
      const safeName = uploadingFile.file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
      const filename = `${timestamp}-${safeName}`;
      const storageRef = ref(storage, `photos/${user.uid}/${filename}`);

      const snapshot = await uploadBytes(storageRef, uploadingFile.file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log("✅ Storage upload complete");

      // 2. Save to Firestore
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, progress: 75 } : f
        )
      );

      const photoRef = await addDoc(collection(db, "photos"), {
        url: downloadURL,
        title: uploadingFile.title,
        description: "",
        uploadedBy: user.uid,
        uploadedByName: user.displayName || user.email || "Unknown",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        albums: uploadingFile.selectedAlbums,
      });
      console.log("✅ Photo saved to Firestore");

      // 3. Update albums (only if there are selected albums)
      if (uploadingFile.selectedAlbums.length > 0) {
        console.log("Updating albums...");
        for (const albumId of uploadingFile.selectedAlbums) {
          try {
            const album = albums?.find((a) => a.id === albumId);
            if (album && album.createdBy === user.uid) {
              await updateDoc(doc(db, "albums", albumId), {
                photoCount: (album.photoCount || 0) + 1,
                updatedAt: serverTimestamp(),
                ...((!album.coverPhoto || album.photoCount === 0) && {
                  coverPhoto: downloadURL,
                }),
              });
              console.log(`✅ Updated album ${albumId}`);
            }
          } catch (albumError: any) {
            console.error(`❌ Failed to update album ${albumId}:`, albumError);
          }
        }
      }

      // 4. Complete
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id
            ? { ...f, progress: 100, url: downloadURL }
            : f
        )
      );

      // 5. Invalidate cache
      CacheInvalidationManager.invalidateForAction("photo-upload", user.uid);
      if (uploadingFile.selectedAlbums.length > 0) {
        CacheInvalidationManager.invalidateForAction("album-update", user.uid);
      }

      // 6. Skip notifications temporarily
      console.log("Skipping notifications for debugging");

      toast.success(`"${uploadingFile.title}" uploaded successfully!`);
      console.log("=== UPLOAD COMPLETE ===");

      // Remove from queue
      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((f) => f.id !== uploadingFile.id)
        );
      }, 2000);
    } catch (error: any) {
      console.error("❌ Upload failed:", error);
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, error: error.message } : f
        )
      );
      toast.error(`Upload failed: ${error.message}`);
    }
  };

  // Update handleFiles to auto-assign album
  const handleFiles = async (files: FileList) => {
    const validFiles = Array.from(files).filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        // 50MB limit
        toast.error(`${file.name} is too large (max 50MB)`);
        return false;
      }
      return true;
    });

    // Create uploading file objects with auto-selected album
    const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      title: file.name.replace(/\.[^/.]+$/, ""),
      selectedAlbums: albumIdFromUrl ? [albumIdFromUrl] : [],
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);
  };

  // Update file settings
  const updateUploadingFile = (
    fileId: string,
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    );
  };

  // Start upload for a specific file
  const startUpload = (file: UploadingFile) => {
    uploadFile(file);
  };

  // Start upload for all files
  const startAllUploads = () => {
    uploadingFiles
      .filter((f) => f.progress === 0 && !f.error)
      .forEach((file) => {
        uploadFile(file);
      });
  };

  // Handle drag and drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      // Reset input
      e.target.value = "";
    }
  };

  const openAlbumModal = (file: UploadingFile) => {
    setSelectedFileForAlbums(file);
    setShowAlbumModal(true);
  };

  const handleAlbumsSelected = (albumIds: string[]) => {
    if (selectedFileForAlbums) {
      updateUploadingFile(selectedFileForAlbums.id, {
        selectedAlbums: albumIds,
      });
    }
    setShowAlbumModal(false);
    setSelectedFileForAlbums(null);
  };

  // Loading state
  if (loading || albumsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Storage error
  if (storageError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 rounded-lg p-4 mb-6">
            <h2 className="text-lg font-semibold text-red-800 dark:text-red-400 mb-2">
              Storage Unavailable
            </h2>
            <p className="text-red-700 dark:text-red-300 text-sm mb-4">
              {storageError}
            </p>
            <button
              onClick={retryStorageInit}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              Try Again
            </button>
          </div>
          <Link
            href="/photos"
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            ← Back to Photos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with album context */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Upload Photos
          </h1>
          {albumIdFromUrl && albums && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <p className="text-blue-800 dark:text-blue-200">
                <span className="font-medium">Adding to album:</span>{" "}
                {albums.find((a: Album) => a.id === albumIdFromUrl)?.title ||
                  "Unknown Album"}
              </p>
            </div>
          )}
          <p className="text-lg text-gray-600 dark:text-gray-300">
            {storageError
              ? "Storage service unavailable. Please try again later."
              : "Drag and drop photos here or click to select files"}
          </p>
        </div>

        {/* Drag and Drop Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
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
            id="file-upload"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={!!storageError}
          />
          <label
            htmlFor="file-upload"
            className={`cursor-pointer ${
              storageError ? "cursor-not-allowed opacity-50" : ""
            }`}
          >
            <svg
              className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
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
            <div className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Drop photos here or click to browse
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              PNG, JPG, GIF up to 50MB each
            </p>
          </label>
        </div>

        {/* Upload Queue */}
        {uploadingFiles.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Upload Queue ({uploadingFiles.length})
              </h2>
              {uploadingFiles.some((f) => f.progress === 0 && !f.error) && (
                <button
                  onClick={startAllUploads}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Upload All
                </button>
              )}
            </div>

            <div className="space-y-4">
              {uploadingFiles.map((file) => (
                <FileUploadItem
                  key={file.id}
                  file={file}
                  albums={albums || []}
                  albumsLoading={albumsLoading}
                  onUpdate={(updates) => updateUploadingFile(file.id, updates)}
                  onUpload={() => startUpload(file)}
                  onSelectAlbums={() => openAlbumModal(file)}
                  onRemove={() =>
                    setUploadingFiles((prev) =>
                      prev.filter((f) => f.id !== file.id)
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        {/* Album Selector Modal */}
        {showAlbumModal && selectedFileForAlbums && (
          <AlbumSelectorModal
            isOpen={showAlbumModal}
            onClose={() => {
              setShowAlbumModal(false);
              setSelectedFileForAlbums(null);
            }}
            title={`Select Albums for "${selectedFileForAlbums.title}"`}
            {...({ onAlbumsSelected: handleAlbumsSelected } as any)}
          />
        )}
      </div>
    </div>
  );
}

// File Upload Item Component
interface FileUploadItemProps {
  file: UploadingFile;
  albums: Album[];
  albumsLoading: boolean;
  onUpdate: (updates: Partial<UploadingFile>) => void;
  onUpload: () => void;
  onSelectAlbums: () => void;
  onRemove: () => void;
}

function FileUploadItem({
  file,
  albums,
  albumsLoading,
  onUpdate,
  onUpload,
  onSelectAlbums,
  onRemove,
}: FileUploadItemProps) {
  const isUploading = file.progress > 0 && file.progress < 100;
  const isComplete = file.progress === 100;
  const hasError = !!file.error;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start space-x-4">
        {/* File Preview */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
            <img
              src={URL.createObjectURL(file.file)}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* File Details */}
        <div className="flex-1 min-w-0">
          <div className="mb-2">
            <input
              type="text"
              value={file.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              disabled={isUploading || isComplete}
              className="w-full px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              placeholder="Photo title..."
            />
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {file.file.name} • {(file.file.size / 1024 / 1024).toFixed(1)} MB
          </div>

          {/* Album Selection */}
          <div className="mb-3">
            <button
              onClick={onSelectAlbums}
              disabled={isUploading || isComplete || albumsLoading}
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 disabled:opacity-50"
            >
              {file.selectedAlbums.length > 0
                ? `Selected: ${file.selectedAlbums.length} album${
                    file.selectedAlbums.length > 1 ? "s" : ""
                  }`
                : "Select Albums"}
            </button>
            {file.selectedAlbums.length > 0 && (
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {file.selectedAlbums
                  .map((albumId) => {
                    const album = albums.find((a) => a.id === albumId);
                    return album?.title || albumId;
                  })
                  .join(", ")}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          {(isUploading || isComplete) && (
            <div className="mb-2">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                <span>
                  {isComplete ? "Complete" : `Uploading... ${file.progress}%`}
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    isComplete
                      ? "bg-green-500"
                      : hasError
                      ? "bg-red-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${file.progress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {hasError && (
            <div className="text-sm text-red-600 dark:text-red-400 mb-2">
              {file.error}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center space-x-2">
          {!isUploading && !isComplete && !hasError && (
            <button
              onClick={onUpload}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Upload
            </button>
          )}

          {isComplete && (
            <div className="text-green-600 dark:text-green-400">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}

          <button
            onClick={onRemove}
            disabled={isUploading}
            className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Main component with Suspense
export default function UploadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      }
    >
      <UploadPageContent />
    </Suspense>
  );
}
