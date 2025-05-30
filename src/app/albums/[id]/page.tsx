"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { doc, getDoc, deleteDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";
import { use } from "react";

export default function AlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [album, setAlbum] = useState<any>(null);
  const [photos, setPhotos] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Unwrap params using React.use()
  const resolvedParams = use(params);
  const albumId = resolvedParams.id;

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    async function fetchAlbumData() {
      try {
        // Fetch album details
        const albumDoc = await getDoc(doc(db, "albums", albumId));

        if (!albumDoc.exists()) {
          router.push("/albums");
          return;
        }

        const albumData = { id: albumDoc.id, ...albumDoc.data() };
        setAlbum(albumData);

        // Fetch photos in this album
        const photosQuery = query(
          collection(db, "photos"),
          where("albums", "array-contains", albumId)
        );
        const photoSnapshot = await getDocs(photosQuery);
        const photosData = photoSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPhotos(photosData);

      } catch (error) {
        console.error("Error fetching album:", error);
        router.push("/albums");
      } finally {
        setIsLoading(false);
      }
    }

    fetchAlbumData();
  }, [user, router, albumId]);

  const handleDeleteAlbum = async () => {
    if (!album || isDeleting) return;

    setIsDeleting(true);
    try {
      // Delete the album document
      await deleteDoc(doc(db, "albums", album.id));

      // Remove album reference from photos (if you're tracking that)
      const updatePromises = photos.map(photo => {
        const updatedAlbums = photo.albums?.filter((albumId: string) => albumId !== album.id) || [];
        return updateDoc(doc(db, "photos", photo.id), { albums: updatedAlbums });
      });

      await Promise.all(updatePromises);

      // Redirect to albums page
      router.push("/albums");

    } catch (error) {
      console.error("Error deleting album:", error);
      alert("Failed to delete album. Please try again.");
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
    <div className="min-h-screen bg-gray-50">
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

            <div  className="flex items-center gap-4">
              <Link
                href="/albums"
                className="text-gray-600 hover:text-gray-800 text-sm"
              >
                ← Back to Albums
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Album Header */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{album.title}</h1>
              {album.description && (
                <p className="text-gray-600 mb-4">{album.description}</p>
              )}
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>{photos.length} photos</span>
                <span>•</span>
                <span>{album.isPublic ? "Public" : "Private"}</span>
                <span>•</span>
                <span>Created by {album.createdByName}</span>
              </div>
            </div>

            {/* Album Actions */}
            <div className="mt-4 md:mt-0 flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:text-red-800 border border-red-200 hover:border-red-300 rounded-lg text-sm transition-colors"
              >
                Delete Album
              </button>

              <Link
                href={`/albums/${album.id}/edit`}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
              >
                Edit Album
              </Link>
            </div>
          </div>
        </div>

        {/* Photos Grid */}
        {photos.length > 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">Photos in this Album</h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {photos.map((photo) => (
                <div key={photo.id}  className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {photo.url ? (
                    <img 
                      src={photo.url}
                      alt={photo.title || "Photo"}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <svg className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity" />
                  <div className="absolute bottom-2 left-2 right-2">
                    <p className="text-white text-sm font-medium truncate opacity-0 group-hover:opacity-100 transition-opacity">
                      {photo.title || "Untitled Photo"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No photos in this album</h3>
            <p className="text-gray-600 mb-6">Add photos to start building your album</p>
            <Link
            href="/upload"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Photos
            </Link>
          </div>
        )}
      </main>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Album</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete "{album.title}"? This action can not be undone.
              The photos will not be deleted, only the album.
            </p>

            <div className="flex items-center justify-end gap-3"> 
             <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50"
             >
                Cancel
             </button>

             <button
              onClick={handleDeleteAlbum}
              disabled={isDeleting}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 transition-colors"
             >
              {isDeleting ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Deleting...
                </div>
              ) : (
                "Delete Album"
              )}
             </button>
            </div>
          </div>

          {/* Click outside to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => !isDeleting && setShowDeleteConfirm(false)} 
          />
        </div>
      )}
    </div>
  );
}