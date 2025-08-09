"use client";

import { useEffect, useState } from "react";

export default function ImageDebugger({ src }: { src: string }) {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  useEffect(() => {
    const img = new Image();
    img.onload = () => setStatus('success');
    img.onerror = () => setStatus('error');
    img.src = src;
  }, [src]);

  return (
    <div className="text-xs p-2 bg-gray-100 dark:bg-gray-800 rounded">
      <div>URL: {src}</div>
      <div>Status: <span className={status === 'success' ? 'text-green-600' : status === 'error' ? 'text-red-600' : 'text-yellow-600'}>{status}</span></div>
      {status === 'error' && (
        <div className="text-red-600">
          ❌ Image failed to load directly
        </div>
      )}  
    </div>
  );
}