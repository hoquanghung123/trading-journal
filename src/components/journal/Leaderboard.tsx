import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, fetchMyProfile, Profile } from "@/lib/journal";
import { Trophy, Flame, User, Medal } from "lucide-react";
import { motion } from "framer-motion";

export function Leaderboard() {
  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ["streak_leaderboard"],
    queryFn: fetchLeaderboard,
    refetchInterval: 60000, // Refresh every minute
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my_profile"],
    queryFn: fetchMyProfile,
  });

  if (loadingLeaderboard) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
              Streak Leaderboard
            </h2>
            <p className="text-xs text-muted-foreground font-medium">
              Top disciplined traders this month
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {leaderboard?.map((profile, index) => (
          <LeaderboardItem
            key={profile.id}
            profile={profile}
            rank={index + 1}
            isMe={profile.id === myProfile?.id}
          />
        ))}
      </div>

      {myProfile && !leaderboard?.find((p) => p.id === myProfile.id) && (
        <>
          <div className="flex items-center gap-2 py-2">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
              Your Position
            </span>
            <div className="flex-1 h-px bg-border/50" />
          </div>
          <LeaderboardItem profile={myProfile} rank="-" isMe={true} />
        </>
      )}
    </div>
  );
}

function LeaderboardItem({
  profile,
  rank,
  isMe,
}: {
  profile: Profile;
  rank: number | string;
  isMe: boolean;
}) {
  const isTopThree = typeof rank === "number" && rank <= 3;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300
        ${
          isMe
            ? "bg-primary/5 border-primary/20 ring-1 ring-primary/10 shadow-lg shadow-primary/5"
            : "bg-muted/30 border-border/50 hover:bg-muted/50 hover:border-border"
        }
      `}
    >
      {/* Rank */}
      <div className="w-8 flex items-center justify-center">
        {rank === 1 ? (
          <Medal className="w-6 h-6 text-yellow-500" />
        ) : rank === 2 ? (
          <Medal className="w-6 h-6 text-slate-400" />
        ) : rank === 3 ? (
          <Medal className="w-6 h-6 text-amber-700" />
        ) : (
          <span className="text-sm font-black text-muted-foreground">#{rank}</span>
        )}
      </div>

      {/* Avatar */}
      <div className="w-10 h-10 rounded-full bg-muted border-2 border-border flex items-center justify-center overflow-hidden shrink-0">
        {profile.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-5 h-5 text-muted-foreground" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-bold truncate ${isMe ? "text-primary" : "text-foreground"}`}>
            {profile.displayName}
          </span>
          {profile.activeTitle && (
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-[8px] font-black text-blue-600 uppercase border border-blue-500/20 whitespace-nowrap">
              {profile.activeTitle}
            </span>
          )}
          {isMe && (
            <span className="px-1.5 py-0.5 rounded-md bg-primary/10 text-[9px] font-black text-primary uppercase">
              You
            </span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground font-medium">
          Best: {profile.longestStreak} days
        </div>
      </div>

      {/* Streak */}
      <div className="flex items-center gap-2 bg-orange-500/10 px-3 py-1.5 rounded-xl border border-orange-500/20">
        <Flame
          className={`w-4 h-4 ${profile.currentStreak > 0 ? "text-orange-500 fill-orange-500" : "text-muted-foreground"}`}
        />
        <span
          className={`font-black text-sm ${profile.currentStreak > 0 ? "text-orange-500" : "text-muted-foreground"}`}
        >
          {profile.currentStreak}
        </span>
      </div>
    </motion.div>
  );
}
