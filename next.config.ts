import type { NextConfig } from "next";

const projectRoot = process.cwd();

const nextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  allowedDevOrigins: ["10.228.239.71"],
} as unknown as NextConfig;

export default nextConfig;
