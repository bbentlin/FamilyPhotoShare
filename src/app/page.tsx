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
              <div className="relative h-[400px] w-full">
                <Image
                  src="/family-photos.jpg"
                  alt="Family photo collage"
                  fill
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
          <h2 className="text-3xl font-bold text-center mb-16">Why you'll love our app</h2>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center p-6">
              <div className="bg-blue-100 h-16 w-16 rounded-full flex items-center mx-auto mb-4">
                <svg>
                  <path />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
