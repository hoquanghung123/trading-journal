import { useQuery } from "@tanstack/react-query";
import { fetchLeaderboard, fetchMyProfile, Profile, fetchWeeklyActivity, WeeklyActivity } from "@/lib/journal";
import { Trophy, Flame, User, Medal } from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export function Leaderboard() {
  const { data: leaderboard, isLoading: loadingLeaderboard } = useQuery({
    queryKey: ["streak_leaderboard"],
    queryFn: fetchLeaderboard,
    refetchInterval: 60000,
  });

  const { data: myProfile } = useQuery({
    queryKey: ["my_profile"],
    queryFn: fetchMyProfile,
  });

  const { data: activityData = [] } = useQuery({
    queryKey: ["weekly_activity"],
    queryFn: fetchWeeklyActivity,
    refetchInterval: 60000,
  });

  if (loadingLeaderboard) {
    return (
      <div className="w-full h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
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

      {activityData.length > 0 && <WeeklyActivityChart data={activityData} />}

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

function WeeklyActivityChart({ data }: { data: WeeklyActivity[] }) {
  // Flatten the data for Recharts to handle names with periods correctly
  const chartData = data.map(d => ({
    date: d.date,
    ...d.users
  }));

  const usernames = Array.from(new Set(data.flatMap((d) => Object.keys(d.users))));

  const colors: Record<string, string> = {
    You: "#94A3B8",
  };

  const palette = ["#EAB308", "#3B82F6", "#10B981", "#F43F5E", "#8B5CF6"];
  usernames
    .filter((u) => u !== "You")
    .forEach((u, i) => {
      colors[u] = palette[i % palette.length];
    });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Trophy className="w-6 h-6 text-blue-500" />
          </motion.div>
        </div>
        <h2 className="text-xl font-black text-foreground uppercase tracking-tight">
          Weekly Progress
        </h2>
      </div>

      <div className="bg-white rounded-[32px] p-8 border border-border shadow-sm space-y-6">

      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
            <XAxis
              dataKey="date"
              tickFormatter={(val) => {
                const d = new Date(val + "T00:00:00");
                return ["Su", "M", "Tu", "W", "Th", "F", "Sa"][d.getDay()];
              }}
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 800, fill: "#94A3B8" }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 800, fill: "#94A3B8" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "16px",
                border: "none",
                boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                padding: "12px",
              }}
              itemStyle={{ fontSize: "10px", fontWeight: 800, textTransform: "uppercase" }}
              labelStyle={{ fontSize: "10px", fontWeight: 800, marginBottom: "4px" }}
            />
            {usernames.map((user) => (
              <Line
                key={user}
                type="monotone"
                dataKey={user}
                name={user}
                stroke={colors[user]}
                strokeWidth={3}
                dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                activeDot={{ r: 6, strokeWidth: 0 }}
                animationDuration={1500}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 pt-6 border-t border-slate-100">
        {usernames.map((user) => {
          const totalXp = data.reduce((sum, d) => sum + (d.users[user] || 0), 0);
          return (
            <div key={user} className="flex items-center gap-2">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: colors[user] }}
              />
              <span className="text-[10px] font-black text-slate-800 uppercase tracking-tight">
                {user}
              </span>
              <span className="text-[10px] font-bold text-slate-400">{totalXp} XP</span>
            </div>
          );
        })}
      </div>
    </div>
  </motion.div>
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
