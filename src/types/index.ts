export interface Photo {
  id: string;
  url: string;
  title?: string;
  description?: string;
  createdAt: any;
  createdBy: any;
  albums?: string[];
}

export interface Album {
  id: string;
  title: string;
  description?: string;
  coverPhoto?: string;
  isPublic: boolean;
  createdBy: string;
  createdAt: any;
  updatedAt: any;
  photoCount: number;
}

export interface FamilyMember {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  role?: string;
  joinedAt: string;
}

export interface User {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
}