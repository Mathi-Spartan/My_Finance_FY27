import './globals.css';
import { StoreProvider } from '@/lib/store';

export const metadata = {
  title: 'Ledgerline',
  description: 'Personal finance, recorded the moment money moves.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Ledgerline' },
  icons: { icon: '/icons/icon-192.png', apple: '/icons/icon-192.png' },
};

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EDF0F6' },
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
