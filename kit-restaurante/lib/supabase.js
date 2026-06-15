import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

// Client com service role: ignora RLS. Use SOMENTE no backend.
export const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: { persistSession: false },
});
