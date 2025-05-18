"use client";

import { useState, useEffect }  from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from "@/lib/firebase";

export default function Dashboard() {
  const { user, loading, logOut } = useAuth();
  const router = useRouter();
  const [recentPhotos, setRecentPhotos] = useState([]);
  const [albums, setAlbums] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
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
              onClick={() => logOut()}
              className="text-gray-600 hover:text-gray-800"
            >
              Sign Out
            </button>
            <Link href="/upload" className="px-4 py-2 bg-blue-100 text-blue-600 flex items-center justify-center font-medium">
              Upload Photos
            </Link>
            <div>
              {}
            </div>
          </div>
        </div>
      </header>
    </div>
  )
}