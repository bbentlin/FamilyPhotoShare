"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, loading, markAllRead } = useNotifications(open);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unread = items.filter((n) => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 text-[10px] bg-red-600 text-white rounded-full px-1 min-w-[16px] text-center">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-900 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2 flex items-center justify-between">
            <span className="text-sm font-medium">Notifications</span>
            <button
              type="button"
              onClick={markAllRead}
              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
              disabled={!unread || loading}
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
            {items.length === 0 && (
              <div className="p-4 text-sm text-gray-500">No notifications</div>
            )}
            {items.map((n) => (
              <Link
                key={n.id}
                href={n.url || "#"}
                onClick={() => setOpen(false)}
                className={`block p-3 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 ${
                  n.read ? "text-gray-500" : "text-gray-900 dark:text-gray-100"
                }`}
              >
                {n.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
