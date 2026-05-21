-- Add economic calendar settings to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS forex_news_reminder boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS forex_news_currencies text[] DEFAULT ARRAY['USD', 'EUR', 'GBP', 'CHF', 'AUD', 'NZD', 'JPY', 'CAD']::text[],
ADD COLUMN IF NOT EXISTS forex_news_impacts text[] DEFAULT ARRAY['high', 'medium']::text[],
ADD COLUMN IF NOT EXISTS forex_news_time_daily text DEFAULT '21:00',
ADD COLUMN IF NOT EXISTS forex_news_time_weekly text DEFAULT '08:00';
