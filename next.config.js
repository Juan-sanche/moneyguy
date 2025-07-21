/** @type {import('next').NextConfig} */
const nextConfig = {
  // Exclude NextAuth API routes from static generation
  async rewrites() {
    return []
  },
  
  // Skip static generation for API routes
  trailingSlash: false,
  
  // Exclude NextAuth from static optimization
  async generateStaticParams() {
    return []
  }
}

module.exports = nextConfig
