import "../../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import AuthWrapper from "./authwrapper";
import { ToastProvider } from "@/components/ui/toast";
import { DarkModeProvider } from "@/context/dark-mode-context";
import { Suspense } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { SerwistProvider } from "@serwist/next/react";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

export const metadata = {
	title: "Instinct for UCI",
	description:
		"Discover and connect with clubs at UC Irvine. Instinct helps UCI students find communities, events, and new opportunities — all in one place.",
	metadataBase: new URL("https://instinct-2-0.vercel.app"),
	keywords: [
		"UCI",
		"UC Irvine",
		"UCI clubs",
		"UC Irvine clubs",
		"Instinct",
		"college clubs",
		"campus events",
		"UCI student life",
		"UCI communities",
	],
	authors: [{ name: "Sumanth Pallamreddy" }],
	creator: "Sumanth Pallamreddy",
	viewport: "width=device-width, initial-scale=1",
	manifest: "/manifest.json",
	icons: {
		icon: "/logo.png",
		shortcut: "/logo.png",
		apple: "/logo.png",
	},
	openGraph: {
		title: "Instinct for UC Irvine",
		description:
			"Explore UCI clubs, events, and student communities. Find your place at UC Irvine with Instinct.",
		url: "https://instinct-2-0.vercel.app/",
		siteName: "Instinct for UCI",
		images: [
			{
				url: "/logo.png",
				width: 1200,
				height: 630,
				alt: "Instinct for UCI Clubs and Events",
				type: "image/png",
			},
		],
		locale: "en_US",
		type: "website",
	},
	twitter: {
		card: "summary_large_image",
		site: "@lifeofsumpal_",
		creator: "@lifeofsumpal_",
		title: "Instinct for UC Irvine",
		description: "Find your community. Explore UCI clubs and events.",
		images: ["/logo.png"],
	},
	other: {
		"mobile-web-app-capable": "yes",
		"apple-mobile-web-app-capable": "yes",
		"apple-mobile-web-app-status-bar-style": "black-translucent",
		"apple-mobile-web-app-title": "Instinct",
		"application-name": "Instinct - UCI Club Discovery",
		"msapplication-TileColor": "#000000",
		"msapplication-TileImage": "/logo.png",
		"theme-color": "#000000",
		"color-scheme": "light dark",
	},
};

// Open the DNS + TCP + TLS connection to the API while the page loads, so the
// first search doesn't pay for the handshake. Same env var as src/lib/api.js.
const API_ORIGIN = new URL(
	process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000",
).origin;

// Resolve theme before first paint: instinct-theme (system|light|dark),
// with fallback to legacy isDarkMode, then prefers-color-scheme.
const themeScript = `try{
var t=localStorage.getItem('instinct-theme');
if(t!=='light'&&t!=='dark'&&t!=='system'){
  var legacy=localStorage.getItem('isDarkMode');
  t=legacy==='true'?'dark':legacy==='false'?'light':'system';
}
var dark=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
if(dark)document.documentElement.classList.add('dark');
else document.documentElement.classList.remove('dark');
}catch(e){}`;

export default function RootLayout({ children }) {
	return (
		<html
			lang="en"
			suppressHydrationWarning
			className={`${GeistSans.variable} ${GeistMono.variable}`}
		>
			<head>
				<link rel="preconnect" href={API_ORIGIN} crossOrigin="anonymous" />
				<link rel="dns-prefetch" href={API_ORIGIN} />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline theme bootstrap, no user input */}
				<script dangerouslySetInnerHTML={{ __html: themeScript }} />
			</head>
			<body className="min-h-screen bg-background font-sans text-foreground antialiased">
				<SerwistProvider
					swUrl="/sw.js"
					disable={process.env.NODE_ENV !== "production"}
					reloadOnOnline
				/>
				<Suspense fallback={<div>Loading...</div>}>
					<ToastProvider>
						<AuthWrapper>
							<DarkModeProvider>{children}</DarkModeProvider>
							<Analytics />
							<SpeedInsights />
						</AuthWrapper>
					</ToastProvider>
				</Suspense>
			</body>
		</html>
	);
}
