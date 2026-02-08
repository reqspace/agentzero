import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Sidebar } from '@/components/sidebar'

export const metadata: Metadata = {
  title: 'Agent Zero — Mission Control',
  description: 'Command center for your Agent Zero AI agent',
  manifest: '/manifest.json',
  icons: { apple: '/icon-192.png' },
}

export const viewport: Viewport = {
  themeColor: '#08090c',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Fira+Code:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-0 text-text-1 font-display">
        <div className="ambient-glow" />
        <div className="ambient-teal" />
        <div className="noise-overlay" />
        <Sidebar />
        <main className="md:ml-[68px] h-screen overflow-hidden relative z-10">
          {children}
        </main>
      </body>
    </html>
  )
}
