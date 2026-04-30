import { supabase } from "./src/integrations/supabase/client";

async function test() {
  const query = supabase.from("trading_reviews");
  const x: string = query;
}
