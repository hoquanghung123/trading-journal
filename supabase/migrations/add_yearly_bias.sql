-- Add yearly_bias column to journal_entries
ALTER TABLE journal_entries ADD COLUMN yearly_bias TEXT NOT NULL DEFAULT 'consolidation';
