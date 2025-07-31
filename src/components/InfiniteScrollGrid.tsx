import React, { useEffect, useRef, useCallback } from 'react';

interface InfiniteScrollGridProps {
  children: React.ReactNode;
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  threshold?: number;
}

const InfiniteScrollGrid: React.FC<InfiniteScrollGridProps> = ({
  children,
  hasMore,
  loading,
  onLoadMore,
  threshold = 200 // Load more when 200px from bottom
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const handleScroll = useCallback(() => {
    if (!containerRef.current || loadingRef.current || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < threshold;

    if (isNearBottom && !loading) {
      loadingRef.current = true;
      onLoadMore();
    }
  }, [hasMore, loading, onLoadMore, threshold]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', handleScroll, { passive: true });

    // Also check on window scroll for cases where container height = window height
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    }
  }, [handleScroll]);

  useEffect(() => {
    if (!loading) {
      loadingRef.current = false;
    }
  }, [loading]);

  return (
    <div ref={containerRef} className='w-full'>
      {children}

      {/* Loading indicator */}
      {loading && (
        <div className='flex justify-center items-center py-8'>
          <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600'></div>
          <span className='ml-3 text-gray-600 dark:text-gray-400'>Loading more photos...</span>
        </div>
      )}

      {/* End of results indicator */}
      {!hasMore && !loading && (
        <div className='flex justify-center items-center py-8'>
          <span className='text-gray-500 dark:text-gray-400'>No more photos to load</span>
        </div>
      )}
    </div>
  );
};

export default InfiniteScrollGrid;