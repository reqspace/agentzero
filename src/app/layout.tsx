import type { Metadata, Viewport } from 'next'
import { ClerkProvider, SignedIn, SignedOut, SignInButton } from '@clerk/nextjs'
import { dark } from '@clerk/themes'
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
    <ClerkProvider appearance={{ baseTheme: dark }}>
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
          <SignedIn>
            <div className="ambient-glow" />
            <div className="ambient-teal" />
            <div className="noise-overlay" />
            <Sidebar />
            <main className="md:ml-[68px] h-screen overflow-hidden relative z-10">
              {children}
            </main>
          </SignedIn>
          <SignedOut>
            <div className="ambient-glow" />
            <div className="ambient-teal" />
            <div className="noise-overlay" />
            <div className="h-screen flex items-center justify-center relative z-10">
              <div className="text-center space-y-6">
                <div className="w-[72px] h-[72px] rounded-2xl flex items-center justify-center text-3xl font-bold text-white mx-auto" style={{ background: 'linear-gradient(135deg, #00ddb3, #0088cc)' }}>
                  Z
                </div>
                <h1 className="text-2xl font-bold text-text-1">Agent Zero</h1>
                <p className="text-text-3 text-sm">Sign in to access Mission Control</p>
                <SignInButton mode="modal">
                  <button className="gradient-btn px-6 py-3 rounded-xl text-white font-semibold text-sm cursor-pointer">
                    Sign In
                  </button>
                </SignInButton>
              </div>
            </div>
          </SignedOut>
        </body>
      </html>
    </ClerkProvider>
  )
}
