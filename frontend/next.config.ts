import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws"],
  // The browser always calls same-origin /api/*; Next forwards it to the FastAPI backend.
  // Same origin means no CORS setup. Dev -> local uvicorn; production -> the backend
  // Vercel project (override with BACKEND_URL in the frontend project's env vars).
  async rewrites() {
    const backend =
      process.env.NODE_ENV === "development"
        ? "http://localhost:8000"
        : (process.env.BACKEND_URL ?? "https://backend-eight-smoky-28.vercel.app");
    return [{ source: "/api/:path*", destination: `${backend}/api/:path*` }];
  },
  turbopack: {
    resolveAlias: {
      fs: { browser: "./empty-module.js" },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },
};

export default nextConfig;
