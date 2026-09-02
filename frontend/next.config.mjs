import nextPWA from "next-pwa";

const withPWA = nextPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://instinct-2-0.vercel.app' 
      : 'http://localhost:3000'
  },
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

export default withPWA(nextConfig);
