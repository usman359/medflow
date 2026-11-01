import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden() / unauthorized() for role-based access.
    authInterrupts: true,
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
}

export default nextConfig
