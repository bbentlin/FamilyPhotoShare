import { Timestamp } from "firebase/firestore";

export interface Photo {
  id: string;
  url: string;
  title?: string;
  description?: string;
  uploadedByName?: string;
  uploadedBy?: string; // ✅ add
  createdBy?: string; // keep optional during transition
  createdByName?: string;
  createdAt: Timestamp | Date;
  albums?: string[];
}

export interface Album {
  id: string;
  title: string;
  description?: string;
  coverPhoto?: string;
  isPublic: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | Date;
  updatedAt: Timestamp | Date;
  photos?: string[];
  photoCount: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role?: string;
  joinedAt: Timestamp | Date;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}

export interface FirebaseError {
  code: string;
  message: string;
}
