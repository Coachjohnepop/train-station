import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@zoom/meetingsdk"],
  turbopack: {
    resolveAlias: {
      "@zoom/download-manager": "./src/lib/zoom-download-manager-stub.ts",
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@zoom/download-manager": require("path").join(
        __dirname,
        "src/lib/zoom-download-manager-stub.ts",
      ),
    };
    return config;
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
      {
        protocol: "https",
        hostname: "public.blob.vercel-storage.com",
      },
    ],
  },
  // Legacy PWA probes some browsers still hit
  async rewrites() {
    return [
      { source: "/manifest.json", destination: "/manifest.webmanifest" },
      { source: "/site.webmanifest", destination: "/manifest.webmanifest" },
    ];
  },
};

export default nextConfig;