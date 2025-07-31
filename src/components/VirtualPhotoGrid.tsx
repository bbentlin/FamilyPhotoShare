import React, { useCallback, useMemo, useRef, useEffect, useState } from "react";
import { FixedSizeGrid as Grid } from "react-window";
import InfiniteLoader from "react-window-infinite-loader";
import { Photo } from "@/types";

interface VirtualPhotoGridProps {
  photos: Photo[];
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  onPhotoClick: (photo: Photo, index: number) => void;
  onAddToAlbum: (photo: Photo) => void;
  renderPhoto: (props: {
    photo: Photo;
    onClick: () => void;
    onAddToAlbum: () => void;
  }) => React.ReactNode;
}

const VirtualPhotoGrid: React.FC<VirtualPhotoGridProps> = ({
  photos,
  hasMore,
  loading,
  onLoadMore,
  onPhotoClick,
  onAddToAlbum,
  renderPhoto
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate grid dimensions
  const itemSize = 250; // Size of each photo item 
  const gap = 16; // Gap between items
  const minItemsPerRow = 2;
  const maxItemsPerRow = 8;

  const columnCount = useMemo(() => {
    const availableWidth = containerSize.width - gap;
    const itemsPerRow = Math.floor(availableWidth / (itemSize + gap));
    return Math.max(minItemsPerRow, Math.min(maxItemsPerRow, itemsPerRow));
  }, [containerSize.width]);

  const rowCount = Math.ceil(photos.length / columnCount) + (hasMore ? 1 : 0);

  // Handle container resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: 600 });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Check if item is loaded
  const isItemLoaded = useCallback((index: number) => {
    const rowIndex = Math.floor(index / columnCount);
    const totalPhotos = rowIndex * columnCount;
    return totalPhotos < photos.length;
  }, [photos.length, columnCount]);

  // Grid cell renderer
  const Cell = useCallback(({ columnIndex, rowIndex, style }: any) => {
    const photoIndex = rowIndex * columnCount + columnIndex;
    const photo = photos[photoIndex];

    // Loading cell
    if (!photo && hasMore) {
      return (
        <div style={style} className="p-2">
          <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
        </div>
      );
    }

    // Empty cell
    if (!photo) {
      return <div style={style} />
    }

    return (
      <div>
        {renderPhoto({
          photo,
          onClick: () => onPhotoClick(photo, photoIndex),
          onAddToAlbum: () => onAddToAlbum(photo)
        })}
      </div>
    );
  }, [photos, columnCount, hasMore, renderPhoto, onPhotoClick, onAddToAlbum]);

  // Load more items when scrolling near the end
  const loadMoreItems = useCallback(async () => {
    if (!loading && hasMore) {
      onLoadMore();
    }
  }, [loading, hasMore, onLoadMore]);

  if (containerSize.width === 0) {
    return (
      <div ref={containerRef} className="w-full h-96">
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="w-full">
      <InfiniteLoader
        isItemLoaded={isItemLoaded}
        itemCount={hasMore ? photos.length + columnCount : photos.length}
        loadMoreItems={loadMoreItems}
      >
        {({ onItemsRendered, ref }) => (
          <Grid
            ref={ref}
            columnCount={columnCount}
            columnWidth={itemSize + gap}
            height={containerSize.height}
            rowCount={rowCount}
            rowHeight={itemSize + gap}
            width={containerSize.width}
            onItemsRendered={({
              visibleRowStartIndex,
              visibleRowStopIndex,
              visibleColumnStartIndex,
              visibleColumnStopIndex,
            }) => {
              onItemsRendered({
                overscanStartIndex: visibleRowStartIndex * columnCount + visibleColumnStartIndex,
                overscanStopIndex: visibleRowStopIndex * columnCount + visibleColumnStopIndex,
                visibleStartIndex: visibleRowStartIndex * columnCount + visibleColumnStartIndex,
                visibleStopIndex: visibleRowStopIndex * columnCount + visibleColumnStopIndex,
              });
            }}
            style={{
              overflowX: 'hidden', // Prevent horizontal scroll
            }}
          >
            {Cell}
          </Grid>
        )}
      </InfiniteLoader>

      {/* Loading indicator */}
      {loading && (
        <div className="flex justify-center items-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading more photos...</span>
        </div>
      )}

      {/* End indicator */}
      {!hasMore && photos.length > 0 && (
        <div className="text-center py-4">
          <span className="text-gray-500 dark:text-gray-400 text-sm">
            All photos loaded ({photos.length} total)
          </span>
        </div>
      )}
    </div>
  );
};

export default VirtualPhotoGrid;