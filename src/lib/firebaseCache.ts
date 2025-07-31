interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface CacheConfig {
  ttl: number; // Time to live in milliseconds
  maxItems: number;
  persistToLocalStorage?: boolean;
}

class FirebaseCache {
  private cache = new Map<string, CacheItem<any>>();
  private defaultConfig: CacheConfig = {
    ttl: 5 * 60 * 1000, // 5 Minutes
    maxItems: 100,
    persistToLocalStorage: true,
  };

  constructor() {
    if (typeof window !== 'undefined') {
      this.loadFromLocalStorage();
    }
  }

  private generateKey(collection: string, query?: any, userId?: string): string {
    const baseKey = `${collection}_${userId || 'anonymous'}`;
    if (query) {
      const queryString = JSON.stringify(query);
      return `${baseKey}_${btoa(queryString)}`;
    }
    return baseKey;
  }

  private loadFromLocalStorage(): void {
    try {
      const cached = localStorage.getItem('firebase_cache');
      if (cached) {
        const data = JSON.parse(cached);
        // Convert back to Map and check expiration
        Object.entries(data).forEach(([key, value]: [string, any]) => {
          if (value.expiresAt > Date.now()) {
            this.cache.set(key, value);
          }
        });
      }
    } catch (error) {
      console.warn('Failed to load cache from localStorage:', error);
    }
  }

  private saveToLocalStorage(): void {
    try {
      const data = Object.fromEntries(this.cache);
      localStorage.setItem('firebase_cache', JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to save cache to localStorage:', error);
    }
  }

  private evictExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.cache) {
      if (item.expiresAt <= now) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    if (this.cache.size <= this.defaultConfig.maxItems) return;

    // Sort by timestamp and remove oldest
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => a.timestamp - b.timestamp);

    const toRemove = entries.slice(0, this.cache.size - this.defaultConfig.maxItems);
    toRemove.forEach(([key]) => this.cache.delete(key));
  }

  set<T>(
    collection: string,
    data: T,
    config?:Partial<CacheConfig>,
    query?: any, 
    userId?: string
  ): void {
    const finalConfig = { ...this.defaultConfig, ...config };
    const key = this.generateKey(collection, query, userId);

    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + finalConfig.ttl,
    };

    this.cache.set(key, item);

    // Cleanup
    this.evictExpired();
    this.evictOldest();

    if (finalConfig.persistToLocalStorage && typeof window !== 'undefined') {
      this.saveToLocalStorage();
    }
  }

  get<T>(
    collection: string,
    query?: any,
    userId?: string
  ): T | null {
    const key = this.generateKey(collection, query, userId);
    const item = this.cache.get(key);

    if (!item) return null;

    // Check expiration
    if (item.expiresAt <= Date.now()) {
      this.cache.delete(key);
      return null;
    }

    return item.data;
  }

  invalidate(collection: string, query?: any, userId?: string): void {
    if (query || userId) {
      // Invalidate specific query
      const key = this.generateKey(collection, query, userId);
      this.cache.delete(key);
    } else {
      // Invalidate all entries for collection
      for (const key of this.cache.keys()) {
        if (key.startsWith(collection)) {
          this.cache.delete(key);
        }
      }
    }

    if (typeof window !== 'undefined') {
      this.saveToLocalStorage();
    }
  }

  invalidateUser(userId: string): void {
    // Invalidate all entries for a specific user
    for (const key of this.cache.keys()) {
      if (key.includes(`_${userId}_`)) {
        this.cache.delete(key);
      }
    }

    if (typeof window !== 'undefined') {
      this.saveToLocalStorage();
    }
  }

  clear(): void {
    this.cache.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('firebase_cache');
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      entries: this.cache.size,
      expired: Array.from(this.cache.values()).filter(
        item => item.expiresAt <= Date.now()
      ).length,
    };
  }
}

export const firebaseCache = new FirebaseCache();

// Cache configs for different data types
export const CACHE_CONFIGS = {
  photos: { ttl: 10 * 60 * 1000, maxItems: 200 }, // 10 min, more items
  albums: { ttl: 15 * 60 * 1000, maxItems: 50 }, // 15 min
  users: { ttl: 30 * 60 * 1000, maxItems: 100 }, // 30 min
  recent: { ttl: 2 * 60 * 1000, maxItems: 50 }, // 2 min for recent data
} as const;