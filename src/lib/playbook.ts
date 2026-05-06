import { supabase } from "@/integrations/supabase/client";
import { PlaybookModel, PlaybookImage, SetupConfluences } from "@/types/playbook";

type Row = {
  id: string;
  user_id: string;
  name: string;
  timeframe: string | null;
  market_condition: string | null;
  killzones: string | null;
  setup_confluences: any;
  execution_rules: any;
  images: any;
  status: "Approved" | "Testing" | "Under Review";
  definition: string | null;
  moodle_resources: any;
  created_at: string;
  updated_at: string;
};

const fromRow = (r: Row): PlaybookModel => {
  const rawConfluences = r.setup_confluences;
  let setupConfluences: SetupConfluences = { narrative: [], liquidity: [], confirmation: [] };

  if (Array.isArray(rawConfluences)) {
    // Legacy support: if it's just a flat array, put everything into narrative
    setupConfluences.narrative = rawConfluences;
  } else if (rawConfluences && typeof rawConfluences === "object") {
    setupConfluences = {
      narrative: rawConfluences.narrative ?? [],
      liquidity: rawConfluences.liquidity ?? [],
      confirmation: rawConfluences.confirmation ?? [],
    };
  }

  return {
    id: r.id,
    user_id: r.user_id,
    name: r.name,
    timeframe: r.timeframe ?? "",
    marketCondition: r.market_condition ?? "",
    killzones: r.killzones ?? "",
    setupConfluences,
    executionRules: r.execution_rules ?? {},
    images: r.images ?? [],
    status: r.status,
    definition: r.definition ?? "",
    moodleResources: r.moodle_resources ?? [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
};

const toRow = (m: PlaybookModel, userId: string) => ({
  id: m.id,
  user_id: userId,
  name: m.name,
  timeframe: m.timeframe,
  market_condition: m.marketCondition,
  killzones: m.killzones,
  setup_confluences: m.setupConfluences,
  execution_rules: m.executionRules,
  images: m.images,
  status: m.status,
  definition: m.definition,
  moodle_resources: m.moodleResources || [],
});

export async function fetchPlaybook(): Promise<PlaybookModel[]> {
  const { data, error } = await supabase
    .from("playbook_setups")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as Row[]).map(fromRow);
}

export async function upsertSetup(m: PlaybookModel): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not authenticated");

  const row = toRow(m, u.user.id);
  const { error } = await supabase.from("playbook_setups").upsert([row as any]);
  if (error) throw error;
}

export async function deleteSetup(id: string): Promise<void> {
  const { error } = await supabase.from("playbook_setups").delete().eq("id", id);
  if (error) throw error;
}

export const playbookQueryKey = ["playbook"] as const;
