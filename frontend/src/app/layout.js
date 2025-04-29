import "../../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import AuthWrapper from "./authwrapper";
import { ToastProvider } from '@/components/ui/toast';
import { DarkModeProvider } from '@/context/dark-mode-context';
import { Suspense } from 'react'; // ok to import Suspense even without "use client"
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata = {
  title: "Instinct for UCI",
  description: "Discover and connect with clubs at UC Irvine. Instinct helps UCI students find communities, events, and new opportunities — all in one place.",
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
  authors: [
    { name: "Sumanth Pallamreddy"}, // Optional, your personal/professional link
  ],
  creator: "Sumanth Pallamreddy",
  themeColor: "#A7D8FF", // or your preferred brand color
  viewport: "width=device-width, initial-scale=1",
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  openGraph: {
    title: "Instinct for UC Irvine",
    description: "Explore UCI clubs, events, and student communities. Find your place at UC Irvine with Instinct.",
    url: "https://instinct-2-0.vercel.app/", // update to your real domain
    siteName: "Instinct for UCI",
    images: [
      {
        url: "/logo.svg", // ideally create an Open Graph image for sharing
        width: 1200,
        height: 630,
        alt: "Instinct for UCI Clubs and Events",
        type: "image/png",
      },
    ],
    locale: "en_US",
    type: "website",
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
