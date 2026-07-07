import type { Metadata, Viewport } from 'next'
import './globals.css'
import Script from 'next/script'

export const metadata: Metadata = {
  title: 'PlayDaily',
  description: '매일 코드·리듬 챌린지 — 연주하고 공유하세요',
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
      <body>
        {children}
        <a href="https://www.khmusic.co.kr" target="_blank" rel="noopener noreferrer"
          style={{ position: 'fixed', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            fontSize: 13, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.05em',
            textDecoration: 'underline', textUnderlineOffset: 3, zIndex: 9999, whiteSpace: 'nowrap' }}>
          by KH Music
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
