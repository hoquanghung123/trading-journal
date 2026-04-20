-- Create symbols table for per-user managed asset list
CREATE TABLE public.symbols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.symbols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own symbols"
  ON public.symbols FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own symbols"
  ON public.symbols FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own symbols"
  ON public.symbols FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own symbols"
  ON public.symbols FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_symbols_updated_at
  BEFORE UPDATE ON public.symbols
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_symbols_user_id ON public.symbols(user_id);