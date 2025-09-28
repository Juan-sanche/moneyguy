import { getServerSession } from 'next-auth'
import type { NextApiRequest, NextApiResponse } from 'next'
import { NextRequest } from 'next/server'

import { authOptions } from './auth'

function toNextApiRequest(request: NextRequest): NextApiRequest {
  const query = Object.fromEntries(request.nextUrl.searchParams)
  const cookies = Object.fromEntries(
    request.cookies.getAll().map(cookie => [cookie.name, cookie.value])
  )
  const headers: Record<string, string | string[]> = {}
  request.headers.forEach((value, key) => {
    headers[key] = value
  })

  return {
    cookies,
    headers,
    method: request.method,
    query,
  } as unknown as NextApiRequest
}

function createNextApiResponseStub(): NextApiResponse {
  return {
    getHeader() {
      return undefined
    },
    setHeader() {},
    setCookie() {},
  } as unknown as NextApiResponse
}

export async function getCurrentUser(request?: NextRequest) {
  const session = request
    ? await getServerSession(
        toNextApiRequest(request),
        createNextApiResponseStub(),
        authOptions,
      )
    : await getServerSession(authOptions)

  return session?.user ?? null
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
