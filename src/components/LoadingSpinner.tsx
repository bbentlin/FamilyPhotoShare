import { memo } from 'react';

const LoadingSpinner = memo(function LoadingSpinner({
  message = "Loading..."
}: {
  message?: string
}) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
      <span className="ml-2 text-gray-600 dark:text-gray-300">{message}</span>
    </div>
  );
});

export default LoadingSpinner;