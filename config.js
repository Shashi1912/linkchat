// LinkChat settings. Fill in the two values from Supabase:
//   Supabase dashboard -> Project Settings -> API (or "Connect")
//
// These are PUBLIC values. Anyone can see them in the browser, and that is
// fine: the database rules (Row Level Security) protect the data.
// NEVER put the "service_role" / "secret" key here.
window.LINKCHAT_CONFIG = {
  SUPABASE_URL: 'YOUR_SUPABASE_PROJECT_URL',            // e.g. https://abcdxyz.supabase.co
  SUPABASE_PUBLISHABLE_KEY: 'YOUR_SUPABASE_PUBLIC_KEY', // "publishable" or "anon public" key
  ROOM_ID: 'general',
  ROOM_NAME: 'General Chat',
};
