/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.cdninstagram.com',  // Correct wildcard
      },
    ],
    domains: ['levelicytjtkbdvbflzv.supabase.co'],
  },
};

export default nextConfig;
