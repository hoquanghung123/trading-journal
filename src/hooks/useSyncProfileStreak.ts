import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { calculateStreak, fetchMyProfile, syncProfileStreak, type DayEntry } from "@/lib/journal";

/** Write the live prep streak onto the profile so the sidebar and leaderboard match. */
export function useSyncProfileStreak(entries: DayEntry[] | undefined) {
  const queryClient = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["my_profile"],
    queryFn: fetchMyProfile,
  });

  useEffect(() => {
    if (!entries || !profile) return;
    const stats = calculateStreak(entries);
    const longestStreak = Math.max(stats.longestStreak, profile.longestStreak);
    if (stats.currentStreak === profile.currentStreak && longestStreak === profile.longestStreak) {
      return;
    }

    let cancelled = false;
    syncProfileStreak({ ...stats, longestStreak })
      .then(() => {
        if (cancelled) return;
        queryClient.invalidateQueries({ queryKey: ["my_profile"] });
        queryClient.invalidateQueries({ queryKey: ["streak_leaderboard"] });
      })
      .catch((err) => console.error("Failed to sync streak", err));

    return () => {
      cancelled = true;
    };
  }, [entries, profile, queryClient]);
}
