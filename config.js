// LinkChat settings. Fill in the two values from Supabase:
//   Supabase dashboard -> Project Settings -> API (or "Connect")
//
// These are PUBLIC values. Anyone can see them in the browser, and that is
// fine: the database rules (Row Level Security) protect the data.
// NEVER put the "service_role" / "secret" key here.
window.LINKCHAT_CONFIG = {
  SUPABASE_URL: 'https://wutfwjontezmagjpevbw.supabase.co',            // e.g. https://abcdxyz.supabase.co
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_QYKskmiELV_oCl8KdjPcig_Fb_2mXCc', // "publishable" or "anon public" key
  ROOM_ID: 'general',
  ROOM_NAME: 'General Chat',
};
