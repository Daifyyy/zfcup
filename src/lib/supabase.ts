import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Chybí VITE_SUPABASE_URL nebo VITE_SUPABASE_ANON_KEY v .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      // Explicitly force apikey header — workaround for supabase-js v2.99+ behavior
      'apikey': supabaseAnonKey,
    },
  },
})
