// Add this line at the very top of your NextAuth route file:
export const dynamic = 'force-dynamic'

import NextAuth from 'next-auth'
import { authOptions } from '../../../../../lib/auth'

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
