export type ReviewType = "weekly" | "monthly";

export interface Mistake {
  id: string;
  text: string;
  fixed: boolean;
}

export interface ActionPlanItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface ActionPlan {
  hardRules: ActionPlanItem[];
  optimization: ActionPlanItem[];
  training: ActionPlanItem[];
}

export interface Review {
  id: string; // timestamp or uuid
  period: string; // e.g. "2026-W17", "2026-04"
  type: ReviewType;

  // Self-Reflection
  technicalReflection: string;
  psychologicalReflection: string;
  environmentalReflection: string;

  // Mistakes
  topMistakes: Mistake[];

  // Action Plan
  actionPlan: ActionPlan;

  createdAt: number;
  updatedAt: number;
}
