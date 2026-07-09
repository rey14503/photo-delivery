/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['next-auth', 'jose', '@prisma/client', 'bcryptjs'],
}

export default nextConfig
