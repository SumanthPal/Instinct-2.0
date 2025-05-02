import "../../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import AuthWrapper from "./authwrapper";
import { ToastProvider } from '@/components/ui/toast';
import { DarkModeProvider } from '@/context/dark-mode-context';
import { Suspense } from 'react';
import { SpeedInsights } from "@vercel/speed-insights/next";

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
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
  openGraph: {
    title: "Instinct for UC Irvine",
    description: "Explore UCI clubs, events, and student communities. Find your place at UC Irvine with Instinct.",
    url: "https://instinct-2-0.vercel.app/",
    siteName: "Instinct for UCI",
    images: [
      {
        url: "/logo.png", // Removed absolute URL to let metadataBase handle it
        width: 1200,
        height: 630,
        alt: "Instinct for UCI Clubs and Events",
        type: "image/png", // Changed to SVG type
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
    images: ["/logo.png"], // Removed absolute URL
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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