import { createClient } from '@supabase/supabase-js'
import { accessHeader } from './accessCodes'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY v .env.local')
}

// Přístupové kódy soukromých turnajů → hlavička x-access-code u každého dotazu (migrace 15)
const fetchWithAccessCodes: typeof fetch = (input, init) => {
  const codes = accessHeader()
  // Jen databázové dotazy (REST/RPC) — Storage a Auth hlavičku nepotřebují
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (!codes || !url.includes('/rest/v1/')) return fetch(input, init)
  const headers = new Headers(init?.headers)
  headers.set('x-access-code', codes)
  return fetch(input, { ...init, headers })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // Explicitly force apikey header — workaround for supabase-js v2.99+ behavior
      'apikey': supabaseAnonKey,
    },
    fetch: fetchWithAccessCodes,
  },
})
