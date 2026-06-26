import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Cloudflare Pages via @cloudflare/next-on-pages
  experimental: {
    // Enables the edge runtime for Cloudflare Workers compatibility
  },
};

export default nextConfig;
