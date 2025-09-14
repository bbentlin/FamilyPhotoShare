"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Photo } from "@/types";
import { useCachedAlbums } from "@/hooks/useCachedAlbums";

export interface AddToAlbumModalProps {
  isOpen: boolean;
  photo: Photo;
  onClose: () => void;
  onConfirm?: (albumIds: string[]) => Promise<void> | void;
}

export default function AddToAlbumModal({
  isOpen,
  photo,
  onClose,
  onConfirm,
}: AddToAlbumModalProps) {
  const { albums, loading, error } = useCachedAlbums();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelected(new Set());
      setSaving(false);
    }
  }, [isOpen]);

  const toggle = (albumId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(albumId)) next.delete(albumId);
      else next.add(albumId);
      return next;
    });
  };

  const selectedCount = selected.size;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onConfirm?.(Array.from(selected));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add to album
          </h2>
          <button
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={onClose}
            aria-label="Close"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Choose album(s) for:{" "}
            <span className="font-medium">{photo.title || photo.id}</span>
          </div>
        </div>

        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {loading && (
            <div className="text-sm text-gray-500">Loading albums…</div>
          )}
          {error && (
            <div className="text-sm text-red-500">Error: {String(error)}</div>
          )}
          {!loading && !error && albums?.length === 0 && (
            <div className="text-sm text-gray-600 dark:text-gray-400">
              No albums yet. Create one on the Albums page.
            </div>
          )}

          <ul className="space-y-2">
            {albums?.map((album) => (
              <li key={album.id}>
                <label className="flex items-center gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={selected.has(album.id)}
                    onChange={() => toggle(album.id)}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {album.title || "Untitled album"}
                    </div>
                    {album.description && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {album.description}
                      </div>
                    )}
                  </div>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCount} selected
          </div>
          <div className="flex gap-2">
            <button
              className="px-3 py-2 rounded border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              onClick={handleSave}
              disabled={saving || selectedCount === 0}
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
