import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Azure's Zip Deploy with WEBSITE_RUN_FROM_PACKAGE mounts the app read-only,
    // and Next's built-in image optimizer writes its cache to `.next/cache`.
    // Nothing else in this app touches the runtime cache, so this is the one
    // thing standing in the way of a read-only deployment.
    unoptimized: true,
  },
};

export default nextConfig;
