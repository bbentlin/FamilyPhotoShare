"use client";

import React from "react";
import { Photo } from "@/types";
import PhotoGridItem from "./PhotoGridItem";

interface VirtualPhotoItemProps {
  photo: Photo;
  onClick: () => void;
  onAddToAlbum: () => void;
  style?: React.CSSProperties;
  priority?: boolean;
}

const VirtualPhotoItem = React.memo(function VirtualPhotoItem({
  photo,
  onClick,
  onAddToAlbum,
  style,
  priority,
}: VirtualPhotoItemProps) {
  return (
    <div style={style} className="relative">
      <PhotoGridItem
        photo={photo}
        onPhotoClick={onClick}
        onAddToAlbumClick={onAddToAlbum}
        priority={priority}
      />
    </div>
  );
});

export default VirtualPhotoItem;
