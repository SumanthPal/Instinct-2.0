/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'levelicytjtkbdvbflzv.supabase.co',
      'instinctucistorage.blob.core.windows.net',
      'scontent.cdninstagram.com', // replace with actual Instagram subdomain you use
    ],
    // Optionally also keep remotePatterns if needed for more flexible matching
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'scontent.cdninstagram.com',
      },
    ],
  },
};

export default nextConfig;
