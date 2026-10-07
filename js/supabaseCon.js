import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8';

// Public project URL + publishable key -- safe to ship in client-side
// code on purpose (Supabase's security boundary is Row Level Security on
// each table/function, not keeping this key secret). Never put the
// secret key here.
const SUPABASE_URL = 'https://frrqzyovmxkezscknohx.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_OEEIfnBUrMFi8WyblqBhqw_3sOeBInT';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    },
});
