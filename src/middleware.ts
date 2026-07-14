import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const auth = request.cookies.get('portal_auth')?.value

  const isLoginPage = pathname === '/login'
  const isProtected = pathname.startsWith('/cotizador') || pathname === '/'

  if (!auth && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (auth && isLoginPage) {
    return NextResponse.redirect(new URL('/cotizador', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/cotizador/:path*', '/login'],
}
