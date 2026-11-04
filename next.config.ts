import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Database driver: load from node_modules at runtime instead of bundling it.
  serverExternalPackages: ["postgres"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
