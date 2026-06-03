import type { NextConfig } from "next";
import path from "path";

const nextConfig = {
  // Set Turbopack root to workspace parent and allow dev origin
  turbopack: {
    root: path.resolve(__dirname, ".."),
  },
  allowedDevOrigins: ["10.228.239.71"],
} as unknown as NextConfig;

export default nextConfig;
