import "../../styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import AuthWrapper from "./authwrapper";
import { ToastProvider } from '@/components/ui/toast';

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
        <AuthWrapper>
          <ToastProvider>
            {children}
            <Analytics />
          </ToastProvider>
        </AuthWrapper>
      </body>
    </html>
  );
}
