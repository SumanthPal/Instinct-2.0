/** @type {import('next').NextConfig} */
const nextConfig = {
  unoptimized: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
    ],
  },
};

export default nextConfig;
