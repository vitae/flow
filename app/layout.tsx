import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Flow AI — Upload. Process. Distribute.',
  description: 'AI-powered video distribution platform. Upload once, post everywhere with auto captions, trending music & hashtags.',
  manifest: '/manifest.json',
  icons: { icon: '/favicon.ico', apple: '/apple-touch-icon.png' },
  openGraph: {
    title: 'Flow AI',
    description: 'Upload once, post everywhere with AI.',
    url: 'https://gwdf.pro',
    siteName: 'Flow AI',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-black font-body text-white antialiased">
        <div className="fixed inset-0 bg-grid-pattern bg-grid opacity-100 pointer-events-none z-0" />
        <div className="relative z-10">
          {children}
        </div>
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#111111',
              border: '1px solid #00FF0020',
              color: '#e0e0e0',
              fontFamily: 'Montserrat, sans-serif',
            },
          }}
        />
      </body>
    </html>
  );
}
