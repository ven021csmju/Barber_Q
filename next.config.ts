import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "images.pexels.com" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;
