import { createClient } from '@/lib/supabase/server';
import HomeClient from './HomeClient';

export default async function Page() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return <HomeClient initialLoggedIn={!!user} />;
}
