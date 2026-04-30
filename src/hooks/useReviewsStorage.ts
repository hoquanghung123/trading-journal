import { useState, useEffect } from "react";
import { Review, ReviewType } from "@/types/review";
import { fetchReviews, upsertReview, deleteReview } from "@/lib/reviews";

export function useReviewsStorage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const data = await fetchReviews();
        if (alive) {
          setReviews(data);
          setIsLoaded(true);
        }
      } catch (e) {
        console.error("Failed to fetch reviews", e);
        if (alive) setIsLoaded(true);
      }
    };
    load();
    return () => {
      alive = false;
    };
  }, []);

  const saveReview = async (review: Review) => {
    try {
      const updated = await upsertReview(review);
      setReviews((prev) => {
        const idx = prev.findIndex((r) => r.period === review.period);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = updated;
          return next;
        }
        return [updated, ...prev];
      });
      return updated;
    } catch (e) {
      console.error("Failed to save review", e);
      throw e;
    }
  };

  const removeReview = async (id: string) => {
    try {
      await deleteReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      console.error("Failed to delete review", e);
      throw e;
    }
  };

  const getReviewByPeriod = (period: string) => {
    return reviews.find((r) => r.period === period);
  };

  const getPreviousReview = (currentPeriod: string) => {
    const sorted = [...reviews].sort((a, b) => b.period.localeCompare(a.period));
    const pastReviews = sorted.filter((r) => r.period < currentPeriod);
    return pastReviews[0] || null;
  };

  const createEmptyReview = (period: string, type: ReviewType = "weekly"): Review => ({
    id: "",
    period,
    type,
    technicalReflection: "",
    psychologicalReflection: "",
    environmentalReflection: "",
    topMistakes: [
      { id: "m1", text: "", fixed: false },
      { id: "m2", text: "", fixed: false },
      { id: "m3", text: "", fixed: false },
    ],
    actionPlan: {
      hardRules: [],
      optimization: [],
      training: [],
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    reviews,
    saveReview,
    removeReview,
    getReviewByPeriod,
    getPreviousReview,
    createEmptyReview,
    isLoaded,
  };
}
