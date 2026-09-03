import './globals.css';
import { AuthProvider } from '@/context/AuthContext';

const siteUrl = 'https://tornamesa.app';
const title = 'Tornamesa';
const description =
  'Track the albums you listen to. Rate, review, keep a diary, and share your monthly top.';
const ogImage =
  'https://res.cloudinary.com/ctgcewhd/image/upload/v1787280874/ij7qow0bryxozykymgve.png';

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: '%s · Tornamesa',
  },
  description,
  applicationName: 'Tornamesa',
  keywords: [
    'album diary',
    'music logging',
    'album ratings',
    'monthly top',
    'listening tracker',
  ],
  authors: [{ name: 'josentss', url: 'https://github.com/josentss' }],
  creator: 'josentss',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: siteUrl,
    siteName: 'Tornamesa',
    title,
    description,
    images: [
      {
        url: ogImage,
        width: 1200,
        height: 630,
        alt: 'Tornamesa — album listening diary',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [ogImage],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0a0f16',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="overflow-x-hidden">
      <body className="bg-[#0a0f16] text-[#f0f9ff] min-h-screen flex flex-col antialiased overflow-x-hidden">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
