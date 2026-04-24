import { supabase } from "@/integrations/supabase/client";
import { Review, ReviewType } from "@/types/review";

export const fetchReviews = async (): Promise<Review[]> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("trading_reviews")
    .select("*")
    .eq("user_id", user.id)
    .order("period", { ascending: false });

  if (error) throw error;

  return (data || []).map((row: any) => ({
    id: row.id,
    period: row.period,
    type: row.type as ReviewType,
    technicalReflection: row.technical_reflection || "",
    psychologicalReflection: row.psychological_reflection || "",
    environmentalReflection: row.environmental_reflection || "",
    topMistakes: row.top_mistakes || [],
    actionPlan: row.action_plan || { hardRules: [], optimization: [], training: [] },
    createdAt: new Date(row.created_at).getTime(),
    updatedAt: new Date(row.updated_at).getTime(),
  }));
};

export const upsertReview = async (review: Review): Promise<Review> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const payload = {
    user_id: user.id,
    period: review.period,
    type: review.type,
    technical_reflection: review.technicalReflection,
    psychological_reflection: review.psychologicalReflection,
    environmental_reflection: review.environmentalReflection,
    top_mistakes: review.topMistakes,
    action_plan: review.actionPlan,
    updated_at: new Date().toISOString(),
  };

  // If it's a new review (id is a timestamp string or doesn't exist in DB)
  // we try to find by period + user_id first to avoid duplicates
  const { data: existing } = await supabase
    .from("trading_reviews")
    .select("id")
    .eq("user_id", user.id)
    .eq("period", review.period)
    .single();

  let result;
  if (existing) {
    const { data, error } = await supabase
      .from("trading_reviews")
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    result = data;
  } else {
    const { data, error } = await supabase
      .from("trading_reviews")
      .insert({ ...payload, created_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    result = data;
  }

  return {
    ...review,
    id: result.id,
    createdAt: new Date(result.created_at).getTime(),
    updatedAt: new Date(result.updated_at).getTime(),
  };
};

export const deleteReview = async (id: string): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("trading_reviews")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
};
