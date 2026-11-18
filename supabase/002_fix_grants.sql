-- Fix: Grant SELECT and INSERT on the messages table to the "authenticated" role.
-- RLS policies already limit what each user can see and do,
-- but the underlying PostgreSQL privileges were missing.
-- Run this in Supabase -> SQL Editor -> New query, then click "Run".

GRANT SELECT, INSERT ON public.messages TO authenticated;

-- Also make sure the anon role can read storage (for public photo links)
-- and authenticated can use sequences (for any serial/identity columns).
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;
