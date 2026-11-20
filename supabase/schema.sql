-- ==========================================================================
-- Sundeepa Bamval — Brand & Design Showcase
-- Optional Supabase Persistence Schema (Postgres + Storage Bucket)
-- Run this in your Supabase Dashboard -> SQL Editor
-- ==========================================================================

-- 1. Key-value state table storing the full studio state (designs, categories,
--    collections, brand presence, palette, and client inquiries)
CREATE TABLE IF NOT EXISTS public.atelier_state (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security (backend accesses via SUPABASE_SERVICE_ROLE_KEY)
ALTER TABLE public.atelier_state ENABLE ROW LEVEL SECURITY;

-- 2. Public Storage bucket for lookbook photos, brand logo, and Atelier cover
INSERT INTO storage.buckets (id, name, public)
VALUES ('atelier-uploads', 'atelier-uploads', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to uploaded lookbook images
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Public read atelier uploads'
  ) THEN
    CREATE POLICY "Public read atelier uploads"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'atelier-uploads');
  END IF;
END $$;
