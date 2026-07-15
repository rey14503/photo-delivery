import type { ReactNode } from 'react'
import './globals.css'

export const metadata = {
  title: 'BK Media Box',
}

import { ThemeProvider } from '@/components/ThemeProvider'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
