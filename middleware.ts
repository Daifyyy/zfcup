const USER = 'denis'
const PASS = 'zftest2026'

export default function middleware(request: Request): Response | undefined {
  if (process.env.MAINTENANCE !== 'true') {
    return undefined
  }
  const auth = request.headers.get('authorization')
  const expected = 'Basic ' + btoa(`${USER}:${PASS}`)
  if (auth !== expected) {
    return new Response('Přístup zakázán', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="ZF Cup"' },
    })
  }
  return undefined
}
