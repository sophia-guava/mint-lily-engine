import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Mint & Lily Creator Engine',
  description: 'AI-powered influencer program',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
