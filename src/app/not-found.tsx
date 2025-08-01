import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-6">
          Page Not Found
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
          Sorry, we couldn't find the page you were looking for. It may have been moved or deleted.
        </p>
        <Link
          href="/"
          className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}