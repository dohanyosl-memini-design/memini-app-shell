/** @type {import('next').NextConfig} */
const nextConfig = {
  // A levél-szinkron szerveroldali csomagjait ne bundle-özze a webpack —
  // futásidőben töltődjenek (imapflow/mailparser ESM-es htmlparser2-t húznak).
  experimental: {
    serverComponentsExternalPackages: ['imapflow', 'mailparser'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
}

module.exports = nextConfig
