import { NextRequest, NextResponse } from 'next/server'
import { CLIENT_NAME_COOKIE, isValidClientName } from '@/lib/client-identity'

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name } = body as { name?: unknown }
  if (!isValidClientName(name)) {
    return NextResponse.json({ error: 'A valid name is required' }, { status: 400 })
  }

  const response = NextResponse.json({ success: true })
  response.cookies.set(CLIENT_NAME_COOKIE, name.trim(), {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  })
  return response
}
