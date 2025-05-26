"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "@firebase/firestore";
import { storage, db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";

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
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [albumTitle, setAlbumTitle] = useState("");
  const [error, setError] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);

    // Filter for image files only
    const imageFiles = files.filter(file => file.type.startsWith("image/"));

    if (imageFiles.length !== files.length) {
      setError("Only image files are allowed");
      return;
    }

    // Create preview objects
    const newFiles: PhotoFile[] = imageFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      title: file.name.split(",")[0], // Remove extension
      description: ""
    }));

    setSelectedFiles(prev => [...prev, ...newFiles]);
    setError("");
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => {
      // Clean up the preview URL
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const updateFileMetadata = (index: number, field: "title" | "description", value: string) => {
    setSelectedFiles(prev => 
      prev.map((file, i) => 
        i === index ? { ...file, [field]: value } : file
      )
    );
  };

  const uploadFiles = async () => {
    if (!user || selectedFiles.length === 0) return;

    setIsUploading(true);
    setError("");

    try {
      const uploadedPhotos = [];

      // Upload each file
      for (let i = 0; i < selectedFiles.length; i++) {
        const photoFile = selectedFiles[i];
        const fileId = `${Date.now()}_${i}_${photoFile.file.name}`;

        // Create storage reference
        const storageRef = ref(storage, `photos/${user.uid}/${fileId}`);

        // Upload file
        setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

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
          albumId: null, // I'll implement albums later
          sharedWith: [], // Array of user IDs who can view this photo
          tags: [],
          likes: [],
          comments: []
        });

        uploadedPhotos.push({
          id: photoDoc.id,
          url: downloadURL,
          title: photoFile.title
        });

        setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
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
          photos: uploadedPhotos.map(photo => photo.id),
          photoCount: uploadedPhotos.length,
          coverPhoto: uploadedPhotos[0]?.url || null,
          sharedWith: [],
          isPublic: false,
        });
      }  

      // Clean up preview URLs
      selectedFiles.forEach(file => URL.revokeObjectURL(file.preview));
      
      // Redirect to dashboard
      router.push("/dashboard");

    } catch (error) {
      console.error("Upload error:", error);
      setError("Failed to upload photos. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  // Redirect if not authenticated
  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="relative h-8 w-8">
              <Image
                src="/familylogo.png"
                alt="Family Logo"
                fill
                sizes="32px"
                className="object-contain" 
              />
            </div>
            <span className="text-xl font-bold text-blue-600">FPS</span>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-800"
            >
              Cancel
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Upload Photos</h1>

          {/* Album Title Input */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Album Information</h2>
            <div>
              <label htmlFor="albumTitle" className="block text-sm font-medium text-gray-700 mb-2">
                Album Title
              </label>
              <input 
                type="text"
                value={albumTitle}
                onChange={(e) => setAlbumTitle(e.target.value)}
                placeholder="e.g., Summer Vacation 2024"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                Leave empty to upload individual photos without creating an album
              </p>
            </div>
          </div>

          {/* File Upload Area */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">Select Photos</h2>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="text-xl mb-2">Drop photos here or click to browse</div>
              <p className="text-gray-500 mb-4">Support for JPG, PNG, GIF files</p>

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
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
              <p className="text-red-800">{error}</p>
            </div>
          )}

          {/* Selected Files Preview */}
          {selectedFiles.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">
                Selected Photos ({selectedFiles.length})
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {selectedFiles.map((photoFile, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    <div className="relative h-48">
                      <Image
                        src={photoFile.preview}
                        alt="Preview"
                        fill
                        className="object-cover" 
                      />
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600"
                      >
                        x
                      </button>
                    </div>

                    <div className="p-4 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={photoFile.title}
                          onChange={(e) => updateFileMetadata(index, "title", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Description (Optional)
                        </label>
                        <textarea
                          value={photoFile.description}
                          onChange={(e) => updateFileMetadata(index, "description", e.target.value)}
                          rows={2}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">
                    Ready to upload {selectedFiles.length} photo{selectedFiles.length > 1 ? "s" : ""}
                  </p>
                  {albumTitle && (
                    <p className="text-sm text-gray-500 mt-1">
                      Will be added to album: "{albumTitle}"
                    </p>
                  )}
                </div>

                <button
                  onClick={uploadFiles}
                  disabled={isUploading}
                  className={`px-6 py-3 rounded-lg font-medium ${
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
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(Object.values(uploadProgress).reduce((a, b) => a + b, 0) / selectedFiles.length)}%`
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Uploading photos...
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}