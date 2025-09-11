import nextPWA from "next-pwa";

const withPWA = nextPWA({
	dest: "public",
	disable: process.env.NODE_ENV === "development",
	register: true,
	skipWaiting: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
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
