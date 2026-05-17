import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export function GET() {
  return NextResponse.json(
    { status: 'ok', ts: new Date().toISOString() },
    {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    }
  )
}
