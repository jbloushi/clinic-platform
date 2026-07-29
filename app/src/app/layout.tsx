import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('http://localhost:3000'),
  title: {
    default: 'Dr. Al Jarallah Clinic',
    template: '%s · Dr. Al Jarallah Clinic',
  },
  description:
    'Book specialist medical care at Dr. Al Jarallah Clinic in Hawally and Jahra, Kuwait.',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
