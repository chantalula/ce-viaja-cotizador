import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'CE Viaja — Cotizador',
  description: 'Sistema de cotización de viajes CE Viaja',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body style={{ margin: 0, fontFamily: 'Manrope, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}
