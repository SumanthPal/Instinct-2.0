import '../../styles/globals.css';
import { Analytics } from "@vercel/analytics/react"

export const metadata = {
  title: 'Instinct for UCI',
  description: 'A club app for UC Irvine students',
  icons: {
    icon: '/logo.svg', // Path to your SVG file in the public folder
    type: 'image/svg+xml', // MIME type for SVG
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <Analytics/>
      <body>{children}</body>
    </html>
  );
}