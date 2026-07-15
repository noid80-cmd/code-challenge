import type { Metadata, Viewport } from 'next'
import './globals.css'
import Script from 'next/script'
import { SessionSync } from './components/SessionSync'
import { OAuthHandler } from './components/OAuthHandler'

export const metadata: Metadata = {
  title: '초견챌린지',
  description: '매일 초견 챌린지 — 연주하고 공유하세요',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <SessionSync />
        <OAuthHandler />
        {children}
        <a href="https://www.khmusic.co.kr" target="_blank" rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: 0, left: 0, right: 0, textAlign: 'center',
            padding: '8px 0 10px', background: 'rgba(7,7,13,0.85)', backdropFilter: 'blur(8px)',
            fontSize: 11, fontWeight: 600, color: 'rgba(99,102,241,0.7)', letterSpacing: '0.15em',
            textDecoration: 'none', zIndex: 9999, whiteSpace: 'nowrap' }}>
          by KHMUSIC
        </a>
      </body>
      <Script id="sw-register" strategy="afterInteractive">{`
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.register('/sw.js').catch(() => {});
        }
      `}</Script>
    </html>
  )
}
