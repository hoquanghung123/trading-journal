-- Migration: Create Journal Entries History Table and PITR Stored Procedure
-- Date: 2026-05-28

-- 1. Create the temporal history table
CREATE TABLE IF NOT EXISTS public.journal_entries_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    history_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    history_action TEXT NOT NULL CHECK (history_action IN ('UPDATE', 'DELETE')),
    
    -- Original table columns (mirroring public.journal_entries exactly)
    id UUID NOT NULL,
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    asset TEXT NOT NULL,
    weekly_img TEXT,
    weekly_bias public.bias_type NOT NULL DEFAULT 'consolidation',
    weekly_correct BOOLEAN NOT NULL DEFAULT false,
    daily_img TEXT,
    daily_bias public.bias_type NOT NULL DEFAULT 'consolidation',
    daily_correct BOOLEAN NOT NULL DEFAULT false,
    h4 JSONB NOT NULL DEFAULT '{}'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    monthly_img TEXT,
    monthly_bias public.bias_type DEFAULT 'consolidation',
    monthly_correct BOOLEAN DEFAULT false,
    yearly_img TEXT,
    yearly_bias TEXT DEFAULT 'consolidation'
);

-- 2. Create index for fast lookups by date and asset
CREATE INDEX IF NOT EXISTS idx_journal_entries_history_lookup 
ON public.journal_entries_history(date, asset);

-- 3. Enable RLS on the history table
ALTER TABLE public.journal_entries_history ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policy allowing only admins to query history
CREATE POLICY "Admins can view journal history"
    ON public.journal_entries_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. Create Trigger function to log revisions
CREATE OR REPLACE FUNCTION public.log_journal_entries_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- For UPDATE and DELETE, we capture the old (OLD) row state as the history snapshot
    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.journal_entries_history (
            history_action, id, user_id, date, asset, 
            weekly_img, weekly_bias, weekly_correct, 
            daily_img, daily_bias, daily_correct, h4, notes, 
            created_at, updated_at, monthly_img, monthly_bias, 
            monthly_correct, yearly_img, yearly_bias
        ) VALUES (
            'UPDATE', OLD.id, OLD.user_id, OLD.date, OLD.asset,
            OLD.weekly_img, OLD.weekly_bias, OLD.weekly_correct,
            OLD.daily_img, OLD.daily_bias, OLD.daily_correct, OLD.h4, OLD.notes,
            OLD.created_at, OLD.updated_at, OLD.monthly_img, OLD.monthly_bias,
            OLD.monthly_correct, OLD.yearly_img, OLD.yearly_bias
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.journal_entries_history (
            history_action, id, user_id, date, asset, 
            weekly_img, weekly_bias, weekly_correct, 
            daily_img, daily_bias, daily_correct, h4, notes, 
            created_at, updated_at, monthly_img, monthly_bias, 
            monthly_correct, yearly_img, yearly_bias
        ) VALUES (
            'DELETE', OLD.id, OLD.user_id, OLD.date, OLD.asset,
            OLD.weekly_img, OLD.weekly_bias, OLD.weekly_correct,
            OLD.daily_img, OLD.daily_bias, OLD.daily_correct, OLD.h4, OLD.notes,
            OLD.created_at, OLD.updated_at, OLD.monthly_img, OLD.monthly_bias,
            OLD.monthly_correct, OLD.yearly_img, OLD.yearly_bias
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 6. Bind the trigger to the main journal_entries table
CREATE OR REPLACE TRIGGER log_journal_entries_history_trigger
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.log_journal_entries_revision();

-- 7. Create Stored Procedure for Point-in-Time single-day restoration
CREATE OR REPLACE FUNCTION public.restore_single_journal_version(
    target_date DATE,
    target_asset TEXT,
    version_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    hist_rec RECORD;
    restored_id UUID;
    log_text TEXT;
BEGIN
    -- Safety Check: Ensure caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can perform data restoration.';
    END IF;

    -- Fetch the specific version from history
    SELECT * INTO hist_rec 
    FROM public.journal_entries_history 
    WHERE history_id = version_id AND date = target_date AND asset = target_asset;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Lịch sử phiên bản không tồn tại cho ngày % và tài sản %.', target_date, target_asset;
    END IF;

    -- Delete the current entry in public.journal_entries (using same unique key combo)
    DELETE FROM public.journal_entries 
    WHERE user_id = hist_rec.user_id AND date = target_date AND asset = target_asset;

    -- Restore by inserting the exact snapshot data back
    INSERT INTO public.journal_entries (
        id, user_id, date, asset, 
        weekly_img, weekly_bias, weekly_correct, 
        daily_img, daily_bias, daily_correct, h4, notes, 
        created_at, updated_at, monthly_img, monthly_bias, 
        monthly_correct, yearly_img, yearly_bias
    ) VALUES (
        hist_rec.id, hist_rec.user_id, hist_rec.date, hist_rec.asset,
        hist_rec.weekly_img, hist_rec.weekly_bias, hist_rec.weekly_correct,
        hist_rec.daily_img, hist_rec.daily_bias, hist_rec.daily_correct, hist_rec.h4, hist_rec.notes,
        hist_rec.created_at, now(), hist_rec.monthly_img, hist_rec.monthly_bias,
        hist_rec.monthly_correct, hist_rec.yearly_img, hist_rec.yearly_bias
    ) RETURNING id INTO restored_id;

    -- Create/append details to public.backup_logs
    log_text := '🔄 PITR: Đã khôi phục nhật ký ngày ' || to_char(target_date, 'DD/MM/YYYY') || 
                ' (' || target_asset || ') về trạng thái lúc ' || 
                to_char(hist_rec.history_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI:SS DD/MM/YYYY') || '.';

    INSERT INTO public.backup_logs (date, db_status, r2_status, log_message)
    VALUES (CURRENT_DATE, 'success', 'success', log_text)
    ON CONFLICT (date) DO UPDATE
    SET
      db_status = 'success',
      r2_status = 'success',
      log_message = log_text || chr(10) || COALESCE(backup_logs.log_message, ''),
      updated_at = now();

    RETURN TRUE;
END;
$$;
