/** @type {import('next').NextConfig} */
const nextConfig = {
  // Remove the deprecated appDir
  experimental: {
    // Remove appDir as it's default in Next.js 14
  },
  
  // Add this to fix NextAuth build issue
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals.push('@next-auth/prisma-adapter')
    }
    return config
  },
  
  // Exclude NextAuth routes from static generation
  async generateBuildId() {
    return 'build'
  }
}

module.exports = nextConfig
