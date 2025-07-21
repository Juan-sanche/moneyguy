import { getServerSession } from 'next-auth'
import { authOptions } from './auth'
import { NextRequest } from 'next/server'

export async function getCurrentUser(request?: NextRequest) {
  const session = await getServerSession(authOptions)
  console.log('Session:', session) // Debug log
  console.log('User:', session?.user) // Debug log
  return session?.user
}

export async function requireAuth(request?: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

// Response helpers
export function unauthorizedResponse() {
  return Response.json({ error: 'Unauthorized' }, { status: 401 })
}

export function errorResponse(message: string, status: number = 400) {
  return Response.json({ error: message }, { status })
}

export function successResponse(data: any, status: number = 200) {
  return Response.json(data, { status })
}
