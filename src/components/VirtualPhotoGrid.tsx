import React, {
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useState,
} from "react";
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
    style: React.CSSProperties; // Style is now required
    priority?: boolean;
  }) => React.ReactNode;
}

const VirtualPhotoGrid: React.FC<VirtualPhotoGridProps> = ({
  photos,
  hasMore,
  loading,
  onLoadMore,
  onPhotoClick,
  onAddToAlbum,
  renderPhoto,
}) => {
  const [containerSize, setContainerSize] = useState({ width: 0, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);

  const itemSize = 250;
  const gap = 16;
  const minItemsPerRow = 2;
  const maxItemsPerRow = 8;

  const columnCount = useMemo(() => {
    const availableWidth = containerSize.width - gap;
    const itemsPerRow = Math.floor(availableWidth / (itemSize + gap));
    return Math.max(minItemsPerRow, Math.min(maxItemsPerRow, itemsPerRow));
  }, [containerSize.width]);

  const rowCount = Math.ceil(photos.length / columnCount) + (hasMore ? 1 : 0);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: 600 });
      }
    };

    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  const isItemLoaded = useCallback(
    (index: number) => {
      const rowIndex = Math.floor(index / columnCount);
      const totalPhotos = rowIndex * columnCount;
      return totalPhotos < photos.length;
    },
    [photos.length, columnCount]
  );

  const Cell = useCallback(
    ({ columnIndex, rowIndex, style }: any) => {
      const photoIndex = rowIndex * columnCount + columnIndex;
      const photo = photos[photoIndex];

      // ✅ THIS IS THE FIX: The style from the grid library now includes padding.
      // We apply it directly to the item, removing the wrapper div that was breaking clicks.
      const itemStyle = {
        ...style,
        padding: `${gap / 2}px`,
      };

      if (!photo && hasMore) {
        return (
          <div style={itemStyle}>
            <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        );
      }

      if (!photo) {
        return <div style={itemStyle} />;
      }

      const isAboveTheFold = rowIndex <= 2;

      // The renderPhoto function now receives the final style directly.
      return renderPhoto({
        photo,
        onClick: () => onPhotoClick(photo, photoIndex),
        onAddToAlbum: () => onAddToAlbum(photo),
        style: itemStyle,
        priority: isAboveTheFold,
      });
    },
    [photos, columnCount, hasMore, renderPhoto, onPhotoClick, onAddToAlbum]
  );

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
            overscanRowCount={2}
            onItemsRendered={({
              visibleRowStartIndex,
              visibleRowStopIndex,
            }) => {
              onItemsRendered({
                overscanStartIndex: visibleRowStartIndex * columnCount,
                overscanStopIndex:
                  visibleRowStopIndex * columnCount + (columnCount - 1),
                visibleStartIndex: visibleRowStartIndex * columnCount,
                visibleStopIndex:
                  visibleRowStopIndex * columnCount + (columnCount - 1),
              });
            }}
            style={{ overflowX: "hidden" }}
          >
            {Cell}
          </Grid>
        )}
      </InfiniteLoader>
    </div>
  );
};

export default VirtualPhotoGrid;
