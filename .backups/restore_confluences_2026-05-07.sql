-- ============================================================
-- RESTORE SCRIPT — Playbook Confluences Backup
-- Date: 2026-05-07
-- Use this to restore setup_confluences if Option B migration fails
-- ============================================================

-- Restore HP
UPDATE playbook_setups
SET setup_confluences = '{"narrative": ["orderflow 3 khung đồng thuận", "không kháng cự", "News tương ứng"], "liquidity": ["không kháng cự", "low resistant", "đồng thuận DX1"], "confirmation": ["đi lệnh khi không còn lý do", "ST đảo orderflow"]}'::jsonb
WHERE id = 'fa42e8e4-5a32-431a-9e66-57bcd02f2c16';

-- Restore Filtering Trading Plan
UPDATE playbook_setups
SET setup_confluences = '{"narrative": ["Có DOL ở Daily hoặc Weekly"], "liquidity": ["Không còn resistance"], "confirmation": ["Sweep liquidity hết ở FVG", "Đã vào lệnh là đợi 1 thắng 2 thua", "How To Trade Major Forex Pair"]}'::jsonb
WHERE id = '02b90086-da03-40bf-85b6-249c27e15daa';

-- Restore Flow Trading Plan
UPDATE playbook_setups
SET setup_confluences = '{"narrative": ["m5 không có resistance", "Sweep liquidity hết ở FVG"], "liquidity": ["CR phải nhỏ hơn với FVG"], "confirmation": []}'::jsonb
WHERE id = '90c32e0a-ca24-48d1-889a-3f3d58c497c3';

-- Restore Test Strategy (empty)
UPDATE playbook_setups
SET setup_confluences = '{"narrative": [], "liquidity": [], "confirmation": []}'::jsonb
WHERE id = '7d0caa8c-d355-43dc-abd6-6cceb0d2b880';

-- Restore Filtering Stick Trading Plan (was empty array)
UPDATE playbook_setups
SET setup_confluences = '[]'::jsonb
WHERE id = '1164c4f5-0ffe-4466-abf6-19b85d6fc03b';

-- ============================================================
-- Verify restore
-- ============================================================
SELECT id, name, setup_confluences FROM playbook_setups ORDER BY created_at DESC;
