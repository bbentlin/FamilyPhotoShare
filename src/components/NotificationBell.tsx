"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } =
    useNotifications(open);
  const rootRef = useRef<HTMLDivElement>(null);

  const handleItemClick = useCallback(
    async (n: any) => {
      if (!n.read && n.id) await markAsRead(n.id);
      setOpen(false);
      if (n.url || n.actionUrl) router.push(n.url || n.actionUrl);
    },
    [markAsRead, router]
  );

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return;
    const onDocPointer = (e: MouseEvent | TouchEvent) => {
      const el = rootRef.current;
      if (el && !el.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocPointer);
    document.addEventListener("touchstart", onDocPointer, { passive: true });
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocPointer);
      document.removeEventListener("touchstart", onDocPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Notifications"
        title="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* Bell icon */}
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 006 14h12a1 1 0 00.707-1.707L18 11.586V8a6 6 0 00-6-6zm0 20a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-600 text-white text-xs">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg z-50"
          role="menu"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Notifications
            </span>
            <button
              onClick={() => markAllAsRead()}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Mark all as read
            </button>
          </div>

          <div className="max-h-96 overflow-auto">
            {loading ? (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                Loading…
              </div>
            ) : notifications && notifications.length > 0 ? (
              notifications.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => handleItemClick(n)}
                  className={`w-full text-left px-3 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    n.read ? "opacity-70" : ""
                  }`}
                  role="menuitem"
                >
                  <div className="flex items-start gap-2">
                    <div
                      className={`mt-1 h-2 w-2 rounded-full ${
                        n.read ? "bg-gray-300" : "bg-blue-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-line">
                        {n.message}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="p-4 text-sm text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
