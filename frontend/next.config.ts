import { configs } from "@/lib/config.env";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://192.168.10.108:3000"],
  async rewrites() {
    const backendBaseUrl =
      configs.BACKEND_BASE_URL || "http://localhost:5000";

    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendBaseUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
