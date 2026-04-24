-- Create monthly_funding table
CREATE TABLE IF NOT EXISTS public.monthly_funding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_key TEXT NOT NULL, -- Format: YYYY-MM
    amount DECIMAL NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, month_key)
);

-- Enable RLS
ALTER TABLE public.monthly_funding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own funding" 
ON public.monthly_funding 
FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_monthly_funding_updated_at
    BEFORE UPDATE ON public.monthly_funding
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
