/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  images: {
    domains: [
      "levelicytjtkbdvbflzv.supabase.co",
      "instinctucistorage.blob.core.windows.net",
    ],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.cdninstagram.com", // ✅ Correct wildcard format
      },
    ],
  },
};

// Serwist runs in configurator mode (see serwist.config.mjs + the `build`
// script), so no Next.js plugin wrapper is needed here.
export default nextConfig;
