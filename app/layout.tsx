import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Al-Rahma Mosque — Live Donation Tracker',
  description: 'Follow live donations to the Al-Rahma Mosque New Minaret & Hall Fund.',
  icons: { icon: '/icon.png', apple: '/logo.png' },
  openGraph: {
    title: 'Al-Rahma Mosque — Live Donation Tracker',
    description: 'Follow live donations to the Al-Rahma Mosque New Minaret & Hall Fund.',
    type: 'website'
  },
  robots: { index: true, follow: true }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0e2a14'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans bg-mosque-cream text-mosque-ink">{children}</body>
    </html>
  );
}
