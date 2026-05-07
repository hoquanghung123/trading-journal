export interface PlaybookImage {
  id: string;
  url: string; // Data URL for pasted image
  type: "perfect" | "loss" | "mistake";
  description?: string;
}

/**
 * Dynamic confluence groups. Keys are user-defined group names (e.g. "narrative", "liquidity").
 * `confluenceOrder` in PlaybookModel controls the display order.
 */
export type SetupConfluences = Record<string, string[]>;

/** Default group keys — used as fallback for legacy data and new playbooks */
export const DEFAULT_CONFLUENCE_KEYS = ["narrative", "liquidity", "confirmation"] as const;

export interface ExecutionRules {
  entry: string;
  stopLoss: string;
  takeProfit: string;
  riskPercent: string;
  breakEven: string;
}

export interface MoodleResource {
  id: string;
  title: string;
  description?: string;
  url: string;
  type: "video" | "reading" | "quiz" | "external";
  progress?: number;
  subLinks?: { id: string; title: string; url: string }[];
}

export interface LabNote {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface PlaybookModel {
  id: string;
  user_id?: string;
  name: string;
  timeframe: string;
  marketCondition: string; // e.g., 'Trending', 'Reversal'
  killzones: string;
  setupConfluences: SetupConfluences;
  /** Ordered list of group keys — determines display order in UI */
  confluenceOrder: string[];
  executionRules: ExecutionRules;
  images: PlaybookImage[];
  status: "Approved" | "Testing" | "Under Review";
  definition: string;
  labNotes?: LabNote[];
  moodleResources?: MoodleResource[];
  createdAt?: string;
  updatedAt?: string;
}

