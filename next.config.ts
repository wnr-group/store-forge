import type { NextConfig } from "next";

// Product images are served from the public Supabase Storage bucket.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

// Tenant subdomains in development (<store>.lvh.me:3000): Next blocks dev-only requests (HMR, client chunks
// loaded by dev tooling) from any origin other than localhost. Without this the page never hydrates and
// forms fall back to a plain browser submit. Hostname only: no scheme, no port. Ignored in production.
const rootHost = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase().split(":")[0];
const devOrigins = rootHost ? [rootHost, `*.${rootHost}`] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: devOrigins,
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/products/**" }]
      : [],
  },
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
