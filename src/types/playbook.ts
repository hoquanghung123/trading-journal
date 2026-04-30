export interface PlaybookImage {
  id: string;
  url: string; // Data URL for pasted image
  type: "perfect" | "loss" | "mistake";
  description?: string;
}

export interface SetupConfluences {
  narrative: string[];
  liquidity: string[];
  confirmation: string[];
}

export interface ExecutionRules {
  entry: string;
  stopLoss: string;
  takeProfit: string;
  riskPercent: string;
  breakEven: string;
}

export interface PlaybookModel {
  id: string;
  user_id?: string;
  name: string;
  timeframe: string;
  marketCondition: string; // e.g., 'Trending', 'Reversal'
  killzones: string;
  setupConfluences: SetupConfluences;
  executionRules: ExecutionRules;
  images: PlaybookImage[];
  status: "Approved" | "Testing" | "Under Review";
  definition: string;
  createdAt?: string;
  updatedAt?: string;
}
