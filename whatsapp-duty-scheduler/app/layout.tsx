import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'WhatsApp Duty Scheduler',
  description: 'Auto-extract duties from WhatsApp chats and PDFs',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
