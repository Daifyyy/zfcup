import { NextRequest, NextResponse } from 'next/server'

const USER = 'denis'
const PASS = 'zftest2026'

export function middleware(req: NextRequest) {
  if (process.env.MAINTENANCE !== 'true') {
    return NextResponse.next()
  }
  const auth = req.headers.get('authorization')
  const expected = 'Basic ' + btoa(`${USER}:${PASS}`)
  if (auth !== expected) {
    return new NextResponse('Přístup zakázán', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="ZF Cup"' },
    })
  }
  return NextResponse.next()
}
