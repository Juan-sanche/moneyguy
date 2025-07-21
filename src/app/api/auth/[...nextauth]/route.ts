import NextAuth from 'next-auth'
import { authOptions } from '../../../../../lib/auth'

// This tells Next.js this route is dynamic and should not be statically generated
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
