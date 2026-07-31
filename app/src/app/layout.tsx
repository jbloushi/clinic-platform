import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Noto_Naskh_Arabic, Noto_Sans_Arabic, Source_Serif_4 } from 'next/font/google';
import { directionFor } from '@/lib/i18n';
import { getLocale } from '@/lib/i18n-server';
import './globals.css';

/**
 * Brand typography. Source Serif 4 carries headings, doctor names, dates and
 * prices; IBM Plex Sans carries navigation, labels, forms and body copy. Each
 * has an Arabic sibling so the same hierarchy survives an RTL switch — the
 * Arabic faces sit next in the stack rather than in a separate theme.
 */
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-latin',
  display: 'swap',
});

const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-editorial-latin',
  display: 'swap',
});

const notoSansArabic = Noto_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans-arabic',
  display: 'swap',
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-editorial-arabic',
  display: 'swap',
});

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
  // Brand deep teal — matches the patient header so mobile browser chrome
  // continues the gradient instead of cutting against it.
  themeColor: '#0B5C55',
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      dir={directionFor(locale)}
      suppressHydrationWarning
      className={`${plexSans.variable} ${sourceSerif.variable} ${notoSansArabic.variable} ${notoNaskhArabic.variable}`}
    >
      <body suppressHydrationWarning className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
