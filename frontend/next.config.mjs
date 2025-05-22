/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'levelicytjtkbdvbflzv.supabase.co',
      'instinctucistorage.blob.core.windows.net',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com', // ✅ Correct wildcard format
      },
    ],
  },
};

export default nextConfig;
