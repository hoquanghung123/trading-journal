-- Migration: Centralized JSONB System Temporal Tables & Trigger Auditing
-- Date: 2026-05-28

-- 1. Create the centralized temporal table
CREATE TABLE IF NOT EXISTS public.system_temporal_history (
    history_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    history_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
    history_action TEXT NOT NULL CHECK (history_action IN ('UPDATE', 'DELETE')),
    table_name TEXT NOT NULL,
    row_id UUID NOT NULL,
    user_id UUID NOT NULL,
    snapshot_data JSONB NOT NULL
);

-- 2. Create indices for rapid querying
CREATE INDEX IF NOT EXISTS idx_sys_temporal_lookup 
ON public.system_temporal_history(table_name, row_id);

CREATE INDEX IF NOT EXISTS idx_sys_temporal_timestamp 
ON public.system_temporal_history(history_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sys_temporal_user
ON public.system_temporal_history(user_id);

-- 3. Enable RLS on the new history table
ALTER TABLE public.system_temporal_history ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS Policy allowing only admins to query the temporal logs
DROP POLICY IF EXISTS "Admins can view system temporal history" ON public.system_temporal_history;
CREATE POLICY "Admins can view system temporal history"
    ON public.system_temporal_history FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- 5. Migrate old data from journal_entries_history if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'journal_entries_history') THEN
        INSERT INTO public.system_temporal_history (
            history_id, history_timestamp, history_action, table_name, row_id, user_id, snapshot_data
        )
        SELECT 
            history_id, 
            history_timestamp, 
            history_action, 
            'journal_entries', 
            id, 
            user_id, 
            jsonb_build_object(
                'id', id,
                'user_id', user_id,
                'date', date,
                'asset', asset,
                'weekly_img', weekly_img,
                'weekly_bias', weekly_bias,
                'weekly_correct', weekly_correct,
                'daily_img', daily_img,
                'daily_bias', daily_bias,
                'daily_correct', daily_correct,
                'h4', h4,
                'notes', notes,
                'created_at', created_at,
                'updated_at', updated_at,
                'monthly_img', monthly_img,
                'monthly_bias', monthly_bias,
                'monthly_correct', monthly_correct,
                'yearly_img', yearly_img,
                'yearly_bias', yearly_bias
            )
        FROM public.journal_entries_history;
        
        -- Drop old trigger and table
        DROP TRIGGER IF EXISTS log_journal_entries_history_trigger ON public.journal_entries;
        DROP TABLE IF EXISTS public.journal_entries_history;
    END IF;
END $$;

-- 6. Generic system-wide trigger function to serialize OLD row into JSONB
CREATE OR REPLACE FUNCTION public.log_system_row_revision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    old_row JSONB;
    target_user_id UUID;
    target_row_id UUID;
BEGIN
    old_row := to_jsonb(OLD);
    target_row_id := (old_row->>'id')::UUID;
    target_user_id := (old_row->>'user_id')::UUID;

    IF (TG_OP = 'UPDATE') THEN
        INSERT INTO public.system_temporal_history (
            history_action, table_name, row_id, user_id, snapshot_data
        ) VALUES (
            'UPDATE', TG_TABLE_NAME, target_row_id, target_user_id, old_row
        );
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.system_temporal_history (
            history_action, table_name, row_id, user_id, snapshot_data
        ) VALUES (
            'DELETE', TG_TABLE_NAME, target_row_id, target_user_id, old_row
        );
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$;

-- 7. Bind trigger to key tables
DROP TRIGGER IF EXISTS log_journal_entries_system_history_trigger ON public.journal_entries;
CREATE TRIGGER log_journal_entries_system_history_trigger
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.log_system_row_revision();

DROP TRIGGER IF EXISTS log_trades_system_history_trigger ON public.trades;
CREATE TRIGGER log_trades_system_history_trigger
    BEFORE UPDATE OR DELETE ON public.trades
    FOR EACH ROW
    EXECUTE FUNCTION public.log_system_row_revision();

DROP TRIGGER IF EXISTS log_psychology_logs_system_history_trigger ON public.psychology_logs;
CREATE TRIGGER log_psychology_logs_system_history_trigger
    BEFORE UPDATE OR DELETE ON public.psychology_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.log_system_row_revision();


-- 8. Stored Procedure for atomic restoration of a single version
CREATE OR REPLACE FUNCTION public.restore_single_system_version(
    version_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    hist_rec RECORD;
    log_text TEXT;
    resolved_setup_id UUID;
    resolved_trade_id UUID;
BEGIN
    -- Safety Check: Ensure caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can perform data restoration.';
    END IF;

    -- Fetch the revision snapshot
    SELECT * INTO hist_rec 
    FROM public.system_temporal_history 
    WHERE history_id = version_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Bản ghi lịch sử không tồn tại.';
    END IF;

    -- Conditional restore depending on table
    IF hist_rec.table_name = 'journal_entries' THEN
        -- Delete the current entry to prevent conflicts
        DELETE FROM public.journal_entries 
        WHERE user_id = hist_rec.user_id 
          AND date = (hist_rec.snapshot_data->>'date')::DATE 
          AND asset = (hist_rec.snapshot_data->>'asset');

        -- Insert exact snapshot back
        INSERT INTO public.journal_entries (
            id, user_id, date, asset, 
            weekly_img, weekly_bias, weekly_correct, 
            daily_img, daily_bias, daily_correct, h4, notes, 
            created_at, updated_at, monthly_img, monthly_bias, 
            monthly_correct, yearly_img, yearly_bias
        ) VALUES (
            (hist_rec.snapshot_data->>'id')::UUID,
            (hist_rec.snapshot_data->>'user_id')::UUID,
            (hist_rec.snapshot_data->>'date')::DATE,
            (hist_rec.snapshot_data->>'asset'),
            (hist_rec.snapshot_data->>'weekly_img'),
            (hist_rec.snapshot_data->>'weekly_bias')::public.bias_type,
            (hist_rec.snapshot_data->>'weekly_correct')::BOOLEAN,
            (hist_rec.snapshot_data->>'daily_img'),
            (hist_rec.snapshot_data->>'daily_bias')::public.bias_type,
            (hist_rec.snapshot_data->>'daily_correct')::BOOLEAN,
            (hist_rec.snapshot_data->'h4'),
            (hist_rec.snapshot_data->>'notes'),
            (hist_rec.snapshot_data->>'created_at')::TIMESTAMPTZ,
            now(),
            (hist_rec.snapshot_data->>'monthly_img'),
            (hist_rec.snapshot_data->>'monthly_bias')::public.bias_type,
            (hist_rec.snapshot_data->>'monthly_correct')::BOOLEAN,
            (hist_rec.snapshot_data->>'yearly_img'),
            (hist_rec.snapshot_data->>'yearly_bias')
        );

        log_text := '🔄 PITR: Khôi phục Nhật ký biểu đồ ngày ' || 
                    to_char((hist_rec.snapshot_data->>'date')::DATE, 'DD/MM/YYYY') || 
                    ' (' || (hist_rec.snapshot_data->>'asset') || ').';

    ELSIF hist_rec.table_name = 'trades' THEN
        -- Safeguard setup_id foreign key (Edge Case 2)
        resolved_setup_id := (hist_rec.snapshot_data->>'setup_id')::UUID;
        IF resolved_setup_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.playbook_setups WHERE id = resolved_setup_id) THEN
            resolved_setup_id := NULL;
        END IF;

        -- Delete current matching trade entry
        DELETE FROM public.trades WHERE id = hist_rec.row_id;

        -- Insert exact trade snapshot back
        INSERT INTO public.trades (
            id, user_id, entry_time, symbol, side, gross_pnl, fees, net_pnl,
            actual_rr, max_rr, before_img, after_img, bias_entry_id, notes,
            created_at, updated_at, setup_id, compliance_check,
            daily_img, exit_time, experimental_args, grade, h1_img, h4_img,
            m15_img, m5_img, missed_confluences, monthly_img, risk_percent,
            status, weekly_img
        ) VALUES (
            (hist_rec.snapshot_data->>'id')::UUID,
            (hist_rec.snapshot_data->>'user_id')::UUID,
            (hist_rec.snapshot_data->>'entry_time')::TIMESTAMPTZ,
            (hist_rec.snapshot_data->>'symbol'),
            (hist_rec.snapshot_data->>'side')::public.trade_side,
            (hist_rec.snapshot_data->>'gross_pnl')::NUMERIC,
            (hist_rec.snapshot_data->>'fees')::NUMERIC,
            (hist_rec.snapshot_data->>'net_pnl')::NUMERIC,
            (hist_rec.snapshot_data->>'actual_rr')::NUMERIC,
            (hist_rec.snapshot_data->>'max_rr')::NUMERIC,
            (hist_rec.snapshot_data->>'before_img'),
            (hist_rec.snapshot_data->>'after_img'),
            (hist_rec.snapshot_data->>'bias_entry_id')::UUID,
            (hist_rec.snapshot_data->>'notes'),
            (hist_rec.snapshot_data->>'created_at')::TIMESTAMPTZ,
            now(),
            resolved_setup_id,
            (hist_rec.snapshot_data->>'compliance_check')::BOOLEAN,
            (hist_rec.snapshot_data->>'daily_img'),
            (hist_rec.snapshot_data->>'exit_time')::TIMESTAMPTZ,
            (hist_rec.snapshot_data->'experimental_args'),
            (hist_rec.snapshot_data->>'grade'),
            (hist_rec.snapshot_data->>'h1_img'),
            (hist_rec.snapshot_data->>'h4_img'),
            (hist_rec.snapshot_data->>'m15_img'),
            (hist_rec.snapshot_data->>'m5_img'),
            (hist_rec.snapshot_data->'missed_confluences'),
            (hist_rec.snapshot_data->>'monthly_img'),
            (hist_rec.snapshot_data->>'risk_percent')::NUMERIC,
            (hist_rec.snapshot_data->>'status'),
            (hist_rec.snapshot_data->>'weekly_img')
        );

        log_text := '🔄 PITR: Khôi phục Giao dịch (Trade) ID ' || hist_rec.row_id || 
                    ' (' || (hist_rec.snapshot_data->>'symbol') || ').';

    ELSIF hist_rec.table_name = 'psychology_logs' THEN
        -- Safeguard trade_id foreign key (Edge Case 2)
        resolved_trade_id := (hist_rec.snapshot_data->>'trade_id')::UUID;
        IF resolved_trade_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.trades WHERE id = resolved_trade_id) THEN
            resolved_trade_id := NULL;
        END IF;

        -- Delete current matching psychology log entry
        DELETE FROM public.psychology_logs WHERE id = hist_rec.row_id;

        -- Insert exact psychology log back
        INSERT INTO public.psychology_logs (
            id, user_id, date, morning_mood, morning_notes, pre_trade_emotion,
            post_trade_emotion, entry_rationale, exit_assessment, trade_id,
            created_at, updated_at
        ) VALUES (
            (hist_rec.snapshot_data->>'id')::UUID,
            (hist_rec.snapshot_data->>'user_id')::UUID,
            (hist_rec.snapshot_data->>'date')::DATE,
            (hist_rec.snapshot_data->>'morning_mood'),
            (hist_rec.snapshot_data->>'morning_notes'),
            (hist_rec.snapshot_data->>'pre_trade_emotion'),
            (hist_rec.snapshot_data->>'post_trade_emotion'),
            (hist_rec.snapshot_data->>'entry_rationale'),
            (hist_rec.snapshot_data->>'exit_assessment'),
            resolved_trade_id,
            (hist_rec.snapshot_data->>'created_at')::TIMESTAMPTZ,
            now()
        );

        log_text := '🔄 PITR: Khôi phục Nhật ký tâm lý ngày ' || 
                    to_char((hist_rec.snapshot_data->>'date')::DATE, 'DD/MM/YYYY') || '.';
    END IF;

    -- Insert into backup logs
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


-- 9. Stored Procedure for bulk restoration of a batch of versions
CREATE OR REPLACE FUNCTION public.restore_batch_system_versions(
    batch_timestamp TIMESTAMPTZ,
    target_table TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    hist_rec RECORD;
    restored_count INT := 0;
    log_text TEXT;
BEGIN
    -- Safety Check: Ensure caller is admin
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'Access Denied: Only administrators can perform data restoration.';
    END IF;

    -- Loop through all logs that belong to the exact batch
    FOR hist_rec IN 
        SELECT history_id 
        FROM public.system_temporal_history 
        WHERE history_timestamp = batch_timestamp 
          AND table_name = target_table
    LOOP
        PERFORM public.restore_single_system_version(hist_rec.history_id);
        restored_count := restored_count + 1;
    END LOOP;

    IF restored_count = 0 THEN
        RAISE EXCEPTION 'Không tìm thấy bản ghi nào thuộc lô (batch) này.';
    END IF;

    -- Write single consolidated backup log message
    log_text := '⚡ PITR: Khôi phục hàng loạt thành công ' || restored_count || 
                ' dòng thuộc bảng ' || target_table || ' tại lô lúc ' || 
                to_char(batch_timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI:SS DD/MM/YYYY') || '.';

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
