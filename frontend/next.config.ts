import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["http://localhost:3000","http://localhost:5000","http://192.168.10.108:3000", "http://192.168.10.108:5000"],
  /* config options here */
};

export default nextConfig;
