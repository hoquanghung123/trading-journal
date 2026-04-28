-- Add Monthly Outlook columns to journal_entries
ALTER TABLE journal_entries 
ADD COLUMN monthly_img TEXT,
ADD COLUMN monthly_bias bias_type DEFAULT 'consolidation',
ADD COLUMN monthly_correct BOOLEAN DEFAULT false;
