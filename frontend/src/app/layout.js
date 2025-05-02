import "../../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import AuthWrapper from "./authwrapper";
import { ToastProvider } from '@/components/ui/toast';
import { DarkModeProvider } from '@/context/dark-mode-context';
import { Suspense } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata = {
  title: "Instinct for UCI",
  description: "Discover and connect with clubs at UC Irvine. Instinct helps UCI students find communities, events, and new opportunities — all in one place.",
  metadataBase: new URL('https://instinct-2-0.vercel.app'),
  keywords: [
    "UCI", "UC Irvine", "UCI clubs", "UC Irvine clubs", "Instinct", 
    "college clubs", "campus events", "UCI student life", "UCI communities"
  ],
  authors: [{ name: "Sumanth Pallamreddy" }],
  creator: "Sumanth Pallamreddy",
  themeColor: "#A7D8FF",
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Instinct for UC Irvine",
    description: "Explore UCI clubs, events, and student communities. Find your place at UC Irvine with Instinct.",
    url: "https://instinct-2-0.vercel.app/",
    siteName: "Instinct for UCI",
    images: [
      {
        url: "https://instinct-2-0.vercel.app/logo.svg",
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
    site: "@yourTwitterHandle", // optional
    creator: "@yourTwitterHandle", // optional
    title: "Instinct for UC Irvine",
    description: "Find your community. Explore UCI clubs and events.",
    images: ["https://instinct-2-0.vercel.app/logo.svg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/logo.svg" />
        <link rel="apple-touch-icon" href="/logo.svg" />
        <meta name="theme-color" content="#A7D8FF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Open Graph Embed for Discord, Slack, etc. */}
        <meta property="og:title" content="Instinct for UC Irvine" />
        <meta property="og:description" content="Explore UCI clubs, events, and student communities." />
        <meta property="og:image" content="https://instinct-2-0.vercel.app/logo.svg" />
        <meta property="og:url" content="https://instinct-2-0.vercel.app/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Instinct for UCI" />

        {/* Twitter Embed */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Instinct for UC Irvine" />
        <meta name="twitter:description" content="Find your community. Explore UCI clubs and events." />
        <meta name="twitter:image" content="https://instinct-2-0.vercel.app/logo.svg" />
      </head>
      <body>
        <Suspense fallback={<div>Loading...</div>}>
          <AuthWrapper>
            <ToastProvider>
              <DarkModeProvider>
                {children}
              </DarkModeProvider>
              <Analytics />
              <SpeedInsights />
            </ToastProvider>
          </AuthWrapper>
        </Suspense>
      </body>
    </html>
  );
}
