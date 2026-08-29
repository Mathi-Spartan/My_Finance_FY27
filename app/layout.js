import './globals.css';
import { StoreProvider } from '@/lib/store';

export const metadata = {
  title: 'Kanakku',
  description: 'Every rupee accounted for.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Kanakku' },
  icons: { icon: '/icons/favicon-32.png', apple: '/icons/apple-touch-icon.png' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#0B6FBF' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0D16' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
