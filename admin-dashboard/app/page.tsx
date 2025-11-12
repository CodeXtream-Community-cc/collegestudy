import Image from 'next/image';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-4">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="grid md:grid-cols-2 h-full">
          {/* Left side - Welcome */}
          <div className="bg-primary-600 text-white p-12 flex flex-col justify-center">
            <div className="mb-8">
              <div className="flex justify-center mb-6">
                <Image
                  src="/logo.png"
                  alt="College Study Logo"
                  width={120}
                  height={120}
                  className="object-contain"
                  priority
                />
              </div>
              <h1 className="text-4xl font-bold mb-4">Welcome Back</h1>
              <p className="text-primary-100 text-lg">
                Access your admin dashboard to manage all aspects of the College Study platform.
              </p>
            </div>
            <div className="mt-auto pt-6 border-t border-primary-500">
              <p className="text-primary-100 text-sm">
                Secure access for authorized personnel only.
              </p>
            </div>
          </div>

          {/* Right side - Login */}
          <div className="p-12 flex flex-col justify-center">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Admin Dashboard</h2>
              <p className="text-gray-600">Sign in to continue</p>
            </div>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <a
                  href="/login"
                  className="w-full flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-200"
                >
                  Sign in with Email
                </a>
              </div>
              
              <div className="relative mt-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white text-gray-500">Secure Access</span>
                </div>
              </div>
            </div>
            
            <div className="mt-8 text-center text-sm text-gray-500">
              <p>For authorized administrators only.</p>
              <p className="mt-1">© {new Date().getFullYear()} College Study. All rights reserved.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
