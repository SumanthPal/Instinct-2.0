/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_SITE_URL: process.env.NODE_ENV === 'production' 
      ? 'https://instinct-2-0.vercel.app' 
      : 'http://localhost:3000'
  }
};

export default nextConfig;
