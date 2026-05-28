-- Migration: Secure system_temporal_history against accidental mutations/deletions
-- Date: 2026-05-28
-- Type: Security Hardening

-- 1. Create a security function that throws an exception on any mutation
CREATE OR REPLACE FUNCTION public.prevent_temporal_history_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE EXCEPTION 'TRUY CẬP BỊ TỪ CHỐI: Bảng system_temporal_history được cấu hình bảo mật Vĩnh Viễn (Immutable). Mọi hành động CẬP NHẬT (UPDATE), XÓA (DELETE) hoặc TRUNCATE đều bị chặn để đảm bảo an toàn tuyệt đối cho lịch sử hệ thống. (Lỗi chặn bởi Security Trigger)';
END;
$$;

-- 2. Bind the trigger to intercept any UPDATE, DELETE, or TRUNCATE statements BEFORE they execute
DROP TRIGGER IF EXISTS enforce_temporal_history_immutability ON public.system_temporal_history;
CREATE TRIGGER enforce_temporal_history_immutability
    BEFORE UPDATE OR DELETE OR TRUNCATE ON public.system_temporal_history
    FOR EACH STATEMENT
    EXECUTE FUNCTION public.prevent_temporal_history_mutation();
