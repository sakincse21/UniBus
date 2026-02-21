import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        // ✅ Match any request starting with /api/v1
        source: "/api/v1/:path*",
        // ✅ Proxy it to your actual backend URL
        // Make sure NEXT_PUBLIC_API_URL is set in your .env (e.g., https://paisa-hi-paisa-backend.vercel.app/api/v1)
        destination: `http://192.168.10.108:5000/api/v1/:path*`, 
      },
    ];
  },
};

export default nextConfig;
