import "../../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import AuthWrapper from "./authwrapper";
import { ToastProvider } from '@/components/ui/toast';
import { DarkModeProvider } from '@/context/dark-mode-context';
import { Suspense } from 'react'; // ok to import Suspense even without "use client"

export const metadata = {
  title: "Instinct for UCI",
  description: "A club app for UC Irvine students",
  icons: {
    icon: "/logo.svg",
    type: "image/svg+xml",
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
            </ToastProvider>
          </AuthWrapper>
        </Suspense>
      </body>
    </html>
  );
}
