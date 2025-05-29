"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs, query, orderBy, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Image from "next/image";
import Link from "next/link";

export default function AlbumsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [albums, setAlbums] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingAlbumId, setDeletingAlbumId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    async function fetchAlbums() {
      try {
        const albumsQuery = query(
          collection(db, "albums"),
          orderBy("updatedAt", "desc")
        );
        const albumSnapshot = await getDocs(albumsQuery);
        const albumsData = albumSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAlbums(albumsData);
      } catch (error) {
        console.error("Error fetching albums:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchAlbums();
  }, [user, router]);

  const handleDeleteAlbum = async (albumId: string, albumTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${albumTitle}"? This action cannot be undone.`)) {
      return;
    }

    setDeletingAlbumId(albumId);
    try {
      await deleteDoc(doc(db, "albums", albumId));
      
      // Remove from local state
      setAlbums(albums.filter(album => album.id !== albumId));
      
    } catch (error) {
      console.error("Error deleting album:", error);
      alert("Failed to delete album. Please try again.");
    } finally {
      setDeletingAlbumId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading albums...</p>
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

            <div className="flex items-center gap-4">
              <Link
                href="/albums/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Create Album
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">All Albums</h1>
          <p className="text-gray-600">Browse and manage your photo albums</p>
        </div>

        {albums.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {albums.map((album) => (
              <div
                key={album.id}
                className="group bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
              >
                <Link href={`/albums/${album.id}`} className="block">
                  <div className="aspect-square bg-gray-200 relative">
                    {album.coverPhoto ? (
                      <img
                        src={album.coverPhoto}
                        alt={album.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <svg className="h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 truncate mb-1">{album.title}</h3>
                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{album.description}</p>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{album.photoCount || 0} photos</span>
                      <span>{album.isPublic ? "Public" : "Private"}</span>
                    </div>
                  </div>
                </Link>

                {/* Album Actions */}
                <div className="px-4 pb-4 flex items-center justify-between">
                  <Link
                    href={`/albums/${album.id}`}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Album
                  </Link>
                  
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      handleDeleteAlbum(album.id, album.title);
                    }}
                    disabled={deletingAlbumId === album.id}
                    className="text-red-600 hover:text-red-800 text-sm disabled:opacity-50"
                  >
                    {deletingAlbumId === album.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <svg className="mx-auto h-16 w-16 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No albums yet</h3>
            <p className="text-gray-600 mb-6">Create your first album to organize your photos</p>
            <Link
              href="/albums/new"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Album
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}