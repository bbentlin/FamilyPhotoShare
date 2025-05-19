"use client";

import { useState, useEffect }  from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from "@/lib/firebase";

export default function Dashboard() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [recentPhotos, setRecentPhotos] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [albums, setAlbums] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [familyMembers, setFamilyMembers] = useState<Array<{ id: string; [key: string]: any }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Fetch data from Firestore
  useEffect(() => {
    async function fetchData() {
      if (user) {
        try {
          // Fetch recent photos
          const photosQuery = query(
            collection(db, "photos"),
            orderBy("createdAt", "desc"),
            limit(4)
          );
          const photoSnapshot = await getDocs(photosQuery);
          const photosData = photoSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setRecentPhotos(photosData);

          // Fetch albums
          const albumsQuery = query(
            collection(db, "albums"),
            orderBy("updatedAt", "desc"),
            limit(3)
          );
          const albumSnapshot = await getDocs(albumsQuery);
          const albumsData = albumSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setAlbums(albumsData);

          // Fetch family members
          const membersQuery = query(
            collection(db, "familyMembers"),
            limit(5)
          );
          const membersSnapshot = await getDocs(membersQuery);
          const membersData = membersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setFamilyMembers(membersData);

        } catch (error) {
          console.error("Error fetching data:", error);
        } finally {
          setIsLoading(false);
        }
      }      
    }

    if (user && !loading) {
      fetchData();
    }
  }, [user, loading]);
  
  if (loading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header / Navbar */}
      <header className="bg-white shadow">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Family Photo Share</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={() => logout()}
              className="text-gray-600 hover:text-gray-800"
            >
              Sign Out
            </button>
            <Link href="/upload" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
              Upload Photos
            </Link>
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
              {user?.displayName?.[0] || user?.email?.[0]?.toUpperCase() || "U"}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main>
        <h1>
          Welcome back, {user?.displayName || user?.email?.split("@")[0] || "Family Member"}!
        </h1>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <Link href="/upload" className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="bg-blue-100 p-3 rounded-full mb-2">
              <svg xmlns="http://www.www3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <span>Upload</span>
          </Link>

          <Link href="/albums/new" className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="bg-green-100 p-3 rounded-full mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <span>New Album</span>
          </Link>

          <Link href="/invite" className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="bg-purple-100 p-3 rounded-full mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span>Invite</span>
          </Link>

          <Link href="/settings" className="flex flex-col items-center p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
            <div className="bg-amber-100 p-3 rounded-full mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span>Settings</span>
          </Link>
        </div>

        {/* Recent Photos */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Recent Photos</h2>
            <Link href="/photos" className="text-blue-600 hover:underline">View All</Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {recentPhotos.length > 0 ? (
              recentPhotos.map((photo) => (
                <div key={photo.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="relative h-40 w-full">
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.title || "Photo"}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 flex items items-center justify-center">
                        <span className="text-gray-400">Photo</span>
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-medium">{photo.title || "Untitled Photo"}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-4 p-8 text-center">
                <p className="text-gray-500">No photos yet. Upload your first photo!</p>
                <Link href="/upload" className="text-blue-600 font-medium mt-2 inline-block">
                  Upload Photos →
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Albums */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Albums</h2>
            <Link href="/albums" className="text-blue-600 hover:underline">View All</Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {albums.length > 0 ? (
              albums.map((album) => (
                <div key={album.id} className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="relative h-40 w-full">
                    {album.coverUrl ? (
                      <img
                        src={album.coverUrl}
                        alt={album.title}
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">Album Cover</span>
                      </div>
                    )} 
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-lg">{album.title}</h3>
                    <p className="text-gray-500">{album.photoCount || 0} photos</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 p-8 text-center">
                <p className="text-gray-500">No albums yet. Create your first album!</p>
                <Link href="/albums/new" className="text-blue-600 font-medium mt-2 inline-block">
                  Create Album →
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Family Members */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Family Members</h2>
            <Link href="/family" className="text-blue-600 hover:underline">Manage</Link>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex flex-wrap gap-6">
              {familyMembers.length > 0 ? (
                <>
                  {familyMembers.map((member) => (
                    <div key={member.id} className="flex flex-col items-center">
                      <div className="w-16 h-16 rounded-full bg-gray-200 mb-2 flex items-center justify-center">
                        {member.photoUrl ? (
                          <img
                            src={member.photoUrl}
                            alt={member.name}
                            className="w-full h-full rounded-full object-cover" 
                          />
                        ) : (
                          <span className="text-gray-500 text-lg">{member.name?.[0]}</span>
                        )}
                      </div>
                      <span>{member.name}</span>
                    </div>
                  ))}
                </>
              ) : (
                <div className="w-full text-center py-4">
                  <p className="text-gray-500">No family members added yet.</p>
                </div>
              )}

              <Link href="/invite" className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-2 hover:bg-gray-200 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-blue-600">Invite</span>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}