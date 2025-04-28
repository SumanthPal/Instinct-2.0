/** @type {import('next').NextConfig} */
const nextConfig = {
  
    images: {
      remotePatterns: [
        {
          protocol: 'https',
          hostname: 'scontent-lax3-1.cdninstagram.com',
        },
        {
          protocol: 'https',
          hostname: 'scontent-lax3-2.cdninstagram.com',
        },
      ],
    },
  };
  
  export default nextConfig;
