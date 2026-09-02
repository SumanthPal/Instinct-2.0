/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cdninstagram.com", // ✅ Correct wildcard format
      },
      {
        protocol: "https",
        hostname: "pub-8e4c91981ff346a0af2d1a101b9dcc39.r2.dev",
      },
      {
        protocol: "https",
        hostname: "levelicytjtkbdvbflzv.supabase.co",
      },
      {
        protocol: "https",
        hostname: "instinctucistorage.blob.core.windows.net",
      },
    ],
  },
};

// Serwist runs in configurator mode (see serwist.config.mjs + the `build`
// script), so no Next.js plugin wrapper is needed here.
export default nextConfig;
