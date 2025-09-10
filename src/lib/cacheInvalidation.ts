import { firebaseCache } from "./firebaseCache";

export class CacheInvalidationManager {
  // Invalidate photo-related caches when photos are uploaded/deleted
  static invalidatePhotos(userId: string) {
    firebaseCache.invalidate("photos", undefined, userId);
    firebaseCache.invalidate("recent", undefined, userId);
  }

  // Invalidate album-related caches when albums are modified
  static invalidateAlbums(userId: string) {
    firebaseCache.invalidate("albums", undefined, userId);
  }

  // Invalidate everything for a user (useful for logout)
  static invalidateUser(userId: string) {
    firebaseCache.invalidateUser(userId);
  }

  // Smart invalidation based on action
  static invalidateForAction(action: string, userId: string, data?: any) {
    switch (action) {
      case "photo-upload":
      case "photo-delete":
      case "photo-update":
        this.invalidatePhotos(userId);
        break;

      case "album-create":
      case "album-update":
      case "album-delete":
      case "albums-refresh":
      case "album-refresh":
        this.invalidateAlbums(userId);
        break;

      case "photos-refresh":
        this.invalidatePhotos(userId);
        break;

      case "user-logout":
        this.invalidateUser(userId);
        break;
    }
  }
}

// Hook to use in components
export function useCacheInvalidation() {
  return CacheInvalidationManager;
}
