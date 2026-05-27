-- Migration: Add Admin Role and Backup Logs Table
-- Date: 2026-05-28

-- 1. Add role column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member';

-- 2. Promote the primary user account to admin role
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'a14a793c-cf04-4e80-9717-d7f077b6f5a3' OR display_name = 'bsleducduy';

-- 3. Create database backup logs table
CREATE TABLE IF NOT EXISTS public.backup_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
    db_status TEXT NOT NULL CHECK (db_status IN ('success', 'failed', 'running')),
    r2_status TEXT NOT NULL CHECK (r2_status IN ('success', 'failed', 'running')),
    db_size_bytes BIGINT,
    r2_files_count INTEGER,
    r2_size_bytes BIGINT,
    log_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Enable Row Level Security (RLS) on backup_logs
ALTER TABLE public.backup_logs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Allow admins to view backup logs
CREATE POLICY "Admins can view backup logs"
    ON public.backup_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Allow service_role to manage all logs (e.g. GitHub Action using service role key, or Edge Functions)
CREATE POLICY "Service role can manage backup logs"
    ON public.backup_logs FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 6. Add trigger for automatic updated_at timestamp
CREATE TRIGGER update_backup_logs_updated_at
    BEFORE UPDATE ON public.backup_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
