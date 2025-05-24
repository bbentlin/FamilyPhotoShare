import Link from "next/link";
import Image from "next/image";

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center">
            <div className="md:w-1/2  mb-10 md:mb-0">
              <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">Share memories with our family</h1>
              <p className="text-xl text-gray-600 mb-8">A private, secure space for our family's precious moments. Upload, organize, and share photos with the people who matter most.</p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link
                  href="/login"
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-medium text-center hover:bg-blue-700 transition-colors"  
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="px-8 py-3 bg-white text-blue-600 border border-blue-600 rounded-lg font-medium text-center hover:bg-gray-50 transition-colors"
                >
                  Create Account
                </Link>
              </div>
            </div>
            <div className="md:w-1/2">
              <div className="relative h-[400px] w-full" style={{ minHeight: "400px" }}>
                <Image
                  src="/familylogo.png"
                  alt="Family photo collage"
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover rounded-lg shadow-xl"
                  priority 
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-16">Why you'll love this app</h2>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center p-6">
              <div className="bg-blue-100 h-16 w-16 rounded-full flex items-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Private & Secure</h3>
              <p className="text-gray-600">Your photos stay private, only accessible to family members you invite.</p>
            </div>

            <div className="text-center p-6">
              <div className="bg-blue-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Easy Sharing</h3>
              <p className="text-gray-600">Upload photos from any device and share them instantly with our family.</p>
            </div>

            <div className="text-center p-6">
              <div className="bg-blue-100 h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Organize by Events</h3>
              <p className="text-gray-600">Create albums for birthdays, holidays and special moments.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-blue-600 py-16 text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-6">Start sharing memories today</h2>
          <p className="text-xl mb-8 max-w-2xl mx-auto">
            Let us help you preserve your most precious moments.
          </p>
          <Link
            href="/signup"
            className="px-8 py-3 bg-white text-blue-600 rounded-lg font-medium inline-block hover:bg-gray-100 transition-colors"
          >
            Create Your Family Space
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-10">
        <div className="container mx-auto px-4 text-center text-gray-500">
          <p>© {new Date().getFullYear()} Family Photo Share. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
