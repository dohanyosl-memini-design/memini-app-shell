export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!login|api/auth|api/setup|api/mcp|_next/static|_next/image|favicon.ico).*)',
  ],
}
