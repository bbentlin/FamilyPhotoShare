"use client";

import React from "react";
import { Photo } from "@/types";
import PhotoGridItem from "./PhotoGridItem";

interface VirtualPhotoItemProps {
  photo: Photo;
  onClick: () => void;
  onAddToAlbum: () => void;
  style?: React.CSSProperties;
}

const VirtualPhotoItem = React.memo(function VirtualPhotoItem({
  photo,
  onClick,
  onAddToAlbum,
  style,
}: VirtualPhotoItemProps) {
  // The PhotoGridItem component should be the root element returned,
  // and it should receive the style prop directly from the virtualizer.
  return (
    <PhotoGridItem
      photo={photo}
      onPhotoClick={onClick}
      onAddToAlbumClick={onAddToAlbum}
      style={style} 
    />
  );
});

export default VirtualPhotoItem;
