import { describe, it, expect } from 'vitest'
import { POST } from '@/app/api/share/identify/route'

function jsonRequest(body: unknown) {
  return { json: async () => body } as never
}

describe('POST /api/share/identify', () => {
  it('returns 400 for an empty name', async () => {
    const res = await POST(jsonRequest({ name: '' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for a missing name field', async () => {
    const res = await POST(jsonRequest({}))
    expect(res.status).toBe(400)
  })

  it('sets the client_name cookie and returns success for a valid name', async () => {
    const res = await POST(jsonRequest({ name: 'Jane Doe' }))
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toEqual({ success: true })
    const cookie = res.cookies.get('client_name')
    expect(cookie?.value).toBe('Jane Doe')
    expect(cookie?.secure).toBe(false)
    expect(cookie?.sameSite).toBe('lax')
  })
})
