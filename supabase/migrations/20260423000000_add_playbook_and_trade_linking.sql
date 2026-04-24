-- Create playbook_setups table
CREATE TABLE IF NOT EXISTS public.playbook_setups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    timeframe TEXT,
    market_condition TEXT,
    killzones TEXT,
    setup_confluences JSONB DEFAULT '{}'::jsonb,
    execution_rules JSONB DEFAULT '{}'::jsonb,
    images JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Testing' CHECK (status IN ('Approved', 'Testing', 'Under Review')),
    definition TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add columns to trades table
ALTER TABLE public.trades 
ADD COLUMN IF NOT EXISTS setup_id UUID REFERENCES public.playbook_setups(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS compliance_check BOOLEAN DEFAULT FALSE;

-- Enable RLS on playbook_setups
ALTER TABLE public.playbook_setups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own playbook setups" 
ON public.playbook_setups 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_playbook_setups_updated_at
    BEFORE UPDATE ON public.playbook_setups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
