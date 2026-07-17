-- Create telegram_links table to map Telegram chat IDs to Supabase users
CREATE TABLE IF NOT EXISTS public.telegram_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_chat_id TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.telegram_links ENABLE ROW LEVEL SECURITY;

-- Users can only see their own link
CREATE POLICY "Users can view own telegram link"
  ON public.telegram_links
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own telegram link"
  ON public.telegram_links
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own telegram link"
  ON public.telegram_links
  FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_telegram_links_chat_id ON public.telegram_links(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_user_id ON public.telegram_links(user_id);
