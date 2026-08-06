export { default } from 'next-auth/middleware'

export const config = {
  // Az api/cron útvonalak NEM munkamenettel hitelesítenek, hanem a Vercel Cron
  // által küldött `Authorization: Bearer <CRON_SECRET>` fejléccel — amit maguk
  // a végpontok ellenőriznek. Ha a middleware alá esnének, minden ütemezett
  // futás a bejelentkező oldalra terelődne, és csendben elmaradna (a napi
  // biztonsági mentés is).
  matcher: [
    '/((?!login|api/auth|api/setup|api/mcp|api/cron|_next/static|_next/image|favicon.ico).*)',
  ],
}
