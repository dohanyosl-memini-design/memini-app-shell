export { default } from 'next-auth/middleware'

export const config = {
  matcher: [
    '/((?!login|api/auth|api/setup|_next/static|_next/image|favicon.ico).*)',
  ],
}
