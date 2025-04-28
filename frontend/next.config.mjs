/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com', // Match ALL Instagram CDN subdomains
      },
    ],
  },
};

export default nextConfig;
