import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function getRequestUser(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const {
    data: { user },
    error,
  } = await client.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * Queries through this client obey Supabase RLS. Only reuse the bearer header
 * after getRequestUser has validated the JWT; never trust a viewer ID from URL.
 */
export function createRequestSupabaseClient(request, viewer) {
  const authorization = viewer?.id ? request.headers.get('authorization') : null;
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: {
        headers: authorization?.startsWith('Bearer ')
          ? { Authorization: authorization }
          : {},
      },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export function unauthorized(message = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}
