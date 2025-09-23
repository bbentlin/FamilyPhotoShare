"use client";

import React, {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/AuthContext";
import { useCachedAlbums } from "@/hooks/useCachedAlbums";
import { Album } from "@/types";
import { addPhotoToAlbums } from "@/lib/albums";
import { CacheInvalidationManager } from "@/lib/cacheInvalidation";
import { notifyNewUploadSubscribers } from "@/lib/notifications";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getAuth } from "firebase/auth";

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  url?: string;
  error?: string;
  title: string;
  selectedAlbums: string[];
}

function UploadPageContent() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const searchParams = useSearchParams();
  const albumIdFromUrl = searchParams.get("albumId");

  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [dragActive, setDragActive] = useState(false);

  // Album selection modal state for a single queued file
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [selectedFileForAlbums, setSelectedFileForAlbums] =
    useState<UploadingFile | null>(null);

  const {
    albums,
    loading: albumsLoading,
    error: albumsError,
  } = useCachedAlbums(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [loading, user, router]);

  // Auto-select album if coming from /upload?albumId=...
  useEffect(() => {
    if (albumIdFromUrl && albums && uploadingFiles.length > 0) {
      setUploadingFiles((prev) =>
        prev.map((file) => ({
          ...file,
          selectedAlbums: Array.from(
            new Set([...(file.selectedAlbums || []), albumIdFromUrl])
          ),
        }))
      );
    }
    // Only run when albums list is ready or files change
  }, [albumIdFromUrl, albums, uploadingFiles.length]);

  const handleUpload = async (uploadingFile: UploadingFile) => {
    // Start feedback ASAP
    toast.dismiss();
    const startToast = toast.loading(`Starting "${uploadingFile.title}"...`);

    try {
      const auth = getAuth();
      const currentUser = auth.currentUser ?? user;
      if (!currentUser) {
        toast.error("Not signed in.", { id: startToast });
        return;
      }

      const fileRef = ref(
        storage,
        `photos/${currentUser.uid}/${Date.now()}-${uploadingFile.file.name}`
      );
      const task = uploadBytesResumable(fileRef, uploadingFile.file, {
        contentType: uploadingFile.file.type || "image/jpeg",
      });

      task.on(
        "state_changed",
        (snap) => {
          const pct = Math.round(
            (snap.bytesTransferred / snap.totalBytes) * 100
          );
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, progress: Math.max(f.progress, pct) }
                : f
            )
          );
        },
        (err) => {
          console.error("[upload] storage error", err);
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, error: err.code || "Upload failed", progress: 0 }
                : f
            )
          );
          toast.error(err.code || "Upload failed", { id: startToast });
        },
        async () => {
          const downloadURL = await getDownloadURL(task.snapshot.ref);
          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, progress: Math.max(f.progress, 75) }
                : f
            )
          );

          const photoRef = await addDoc(collection(db, "photos"), {
            url: downloadURL,
            title: uploadingFile.title,
            description: "",
            uploadedBy: currentUser.uid,
            uploadedByName:
              currentUser.displayName || currentUser.email || "Unknown",
            createdBy: currentUser.uid,
            createdByName:
              currentUser.displayName || currentUser.email || "Unknown",
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            albums: uploadingFile.selectedAlbums || [],
          });

          // After creating the photo doc (before linking albums)
          const cleanedAlbumIds = Array.from(
            new Set(
              (uploadingFile.selectedAlbums || []).filter(
                (id) => typeof id === "string" && id.trim().length > 0
              )
            )
          );

          if (cleanedAlbumIds.length > 0) {
            try {
              await addPhotoToAlbums(photoRef.id, cleanedAlbumIds, {
                addedBy: currentUser.uid,
              });
            } catch (albumError) {
              console.error("Failed to link photo to albums:", albumError);
            }
          }

          setUploadingFiles((prev) =>
            prev.map((f) =>
              f.id === uploadingFile.id
                ? { ...f, progress: 100, url: downloadURL }
                : f
            )
          );

          CacheInvalidationManager.invalidateForAction(
            "photo-upload",
            currentUser.uid
          );
          if (uploadingFile.selectedAlbums.length > 0) {
            CacheInvalidationManager.invalidateForAction(
              "album-update",
              currentUser.uid
            );
            uploadingFile.selectedAlbums.forEach((id) =>
              CacheInvalidationManager.invalidateAlbumPhotos(id)
            );
          }

          await notifyNewUploadSubscribers({
            uploaderId: currentUser.uid,
            uploaderName:
              currentUser.displayName || currentUser.email || "Someone",
            photoTitle: uploadingFile.title,
            photoUrl: `/photos/${photoRef.id}`,
            photoId: photoRef.id,
          });

          toast.success(`"${uploadingFile.title}" uploaded successfully!`, {
            id: startToast,
          });

          setTimeout(() => {
            setUploadingFiles((prev) =>
              prev.filter((f) => f.id !== uploadingFile.id)
            );
          }, 1200);
        }
      );
    } catch (e: any) {
      console.error("[upload] init error", e);
      setUploadingFiles((prev) =>
        prev.map((f) =>
          f.id === uploadingFile.id ? { ...f, error: "Upload init failed" } : f
        )
      );
      toast.error(e?.message || "Upload init failed");
    }
  };

  // DnD / file input handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFiles = (files: FileList) => {
    const validFiles = Array.from(files).filter((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 50MB`);
        return false;
      }
      return true;
    });

    const newUploadingFiles: UploadingFile[] = validFiles.map((file) => ({
      id: `${Date.now()}-${Math.random()}`,
      file,
      progress: 0,
      title: file.name.replace(/\.[^/.]+$/, ""),
      selectedAlbums: albumIdFromUrl ? [albumIdFromUrl] : [],
    }));

    setUploadingFiles((prev) => [...prev, ...newUploadingFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
      e.target.value = "";
    }
  };

  const startUpload = (file: UploadingFile) => {
    console.log("[upload] start single", file.id);
    handleUpload(file);
  };
  const startAllUploads = () => {
    console.log("[upload] start all");
    const pending = uploadingFiles.filter((f) => f.progress === 0 && !f.error);
    if (pending.length === 0) {
      toast("Nothing to upload.");
      return;
    }
    pending.forEach((file) => handleUpload(file));
  };

  const updateUploadingFile = (
    fileId: string,
    updates: Partial<UploadingFile>
  ) => {
    setUploadingFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, ...updates } : f))
    );
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

  if (loading || albumsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
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
            Drag and drop photos here or click to select files
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
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <svg
              className="mx-auto h-16 w-16 text-gray-400 dark:text-gray-500 mb-4"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M14 22l10-10 10 10M24 12v22"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div className="text-gray-700 dark:text-gray-200 font-medium">
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
                  type="button"
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

        {/* Album Selector Modal for queued file */}
        {showAlbumModal && selectedFileForAlbums && (
          <SimpleAlbumPickerModal
            isOpen={showAlbumModal}
            currentSelection={selectedFileForAlbums.selectedAlbums}
            albums={albums || []}
            onClose={() => {
              setShowAlbumModal(false);
              setSelectedFileForAlbums(null);
            }}
            onSave={handleAlbumsSelected}
          />
        )}
      </div>
    </div>
  );
}

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
  // Create and revoke object URL to avoid leaks
  // Change: allow null initial value
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    const url = URL.createObjectURL(file.file);
    setPreviewUrl(url);
    return () => {
      try {
        URL.revokeObjectURL(url);
      } catch {}
    };
  }, [file.file]);

  const isUploading = file.progress > 0 && file.progress < 100;
  const isComplete = file.progress === 100;
  const hasError = !!file.error;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start space-x-4">
        {/* Preview */}
        <div className="flex-shrink-0">
          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              <img
                src={previewUrl ?? undefined} // avoid empty string
                alt="Preview"
                className="w-full h-full object-cover"
              />
            ) : (
              // simple placeholder while URL is being created
              <div className="w-6 h-6 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
            )}
          </div>
        </div>

        {/* Details */}
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
                  .map(
                    (albumId) =>
                      albums.find((a) => a.id === albumId)?.title || albumId
                  )
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
                />
              </div>
            </div>
          )}

          {/* Error */}
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
              type="button"
              onClick={onUpload}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors"
            >
              Upload
            </button>
          )}

          {isComplete && (
            <div
              className="text-green-600 dark:text-green-400"
              title="Complete"
            >
              <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
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
            title="Remove from queue"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              stroke="currentColor"
              fill="none"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

function SimpleAlbumPickerModal({
  isOpen,
  currentSelection,
  albums,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  currentSelection: string[];
  albums: Album[];
  onClose: () => void;
  onSave: (albumIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(currentSelection)
  );

  useEffect(() => {
    if (isOpen) setSelected(new Set(currentSelection));
  }, [isOpen, currentSelection]);

  if (!isOpen) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Select Albums
          </h2>
          <button
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[55vh]">
          {albums.length === 0 ? (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              No albums yet. Create one on the Albums page.
            </div>
          ) : (
            <ul className="space-y-2">
              {albums.map((a) => (
                <li key={a.id}>
                  <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selected.has(a.id)}
                      onChange={() => toggle(a.id)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {a.title || "Untitled album"}
                      </div>
                      {a.description && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {a.description}
                        </div>
                      )}
                    </div>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selected.size} selected
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={() => onSave(Array.from(selected))}
              disabled={selected.size === 0}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

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
