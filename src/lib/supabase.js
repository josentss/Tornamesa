import { createClient } from '@/lib/supabase/client';
const supabase = createClient();

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('❌ NEXT_PUBLIC_SUPABASE_URL no está configurada');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  throw new Error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY no está configurada');
}

export default supabase;
