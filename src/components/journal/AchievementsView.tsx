import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  fetchUserAchievements,
  ACHIEVEMENT_CONFIG,
  calculateLevel,
  type AchievementLevel,
} from "@/lib/achievements";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  Trophy,
  BookOpen,
  Target,
  Zap,
  TrendingUp,
  Search,
  Award,
  Lock,
  Flame,
  CheckCircle2,
  Check,
} from "lucide-react";


const CATEGORY_ICONS = {
  Psychology: <Shield className="w-6 h-6" />,
  Performance: <TrendingUp className="w-6 h-6" />,
  Knowledge: <BookOpen className="w-6 h-6" />,
};

const KEY_ICONS: Record<string, React.ReactNode> = {
  risk_manager: (
    <img 
      src="/achievements/risk_manager.png" 
      alt="Risk Manager" 
      className="w-full h-full object-contain drop-shadow-lg brightness-110"
    />
  ),
  win_streak: (
    <img 
      src="/achievements/win_streak.png" 
      alt="Streak Master" 
      className="w-full h-full object-contain drop-shadow-lg brightness-110"
    />
  ),
  pnl_growth: (
    <img 
      src="/achievements/pnl_growth.png" 
      alt="Wealth Builder" 
      className="w-full h-full object-contain drop-shadow-lg brightness-110"
    />
  ),
  knowledge_base: (
    <img 
      src="/achievements/research_scholar.png" 
      alt="Research Scholar" 
      className="w-full h-full object-contain drop-shadow-lg brightness-110"
    />
  ),
};

export function AchievementsView() {
  const { data: userAchievements = [] } = useQuery({
    queryKey: ["user_achievements"],
    queryFn: fetchUserAchievements,
  });

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
  });

  const achievements = Object.entries(ACHIEVEMENT_CONFIG).map(([key, config]) => {
    const userStat = userAchievements.find((a) => a.achievementKey === key);
    const currentValue = userStat?.currentValue || 0;
    const currentLevel = calculateLevel(key as any, currentValue);

    // Calculate target for current level
    const milestones = config.milestones;
    let target = milestones.Bronze;
    if (currentLevel === "Bronze") target = milestones.Silver;
    if (currentLevel === "Silver") target = milestones.Gold;
    if (currentLevel === "Gold") target = milestones.Diamond;
    if (currentLevel === "Diamond") target = milestones.Diamond;

    return {
      key,
      ...config,
      progress: currentValue,
      target,
      level: currentLevel,
      icon: KEY_ICONS[key] || <Trophy className="w-6 h-6" />,
    };
  });

  return (
    <div className="space-y-16 pb-20">
      {/* Premium Header */}
      <div className="bg-[#0f172a] rounded-[48px] p-12 text-white relative overflow-hidden shadow-2xl border border-white/5">
        <div className="relative z-10 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 rounded-full border border-yellow-500/20 backdrop-blur-md"
          >
            <Award className="w-4 h-4 text-yellow-400" />
            <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400">
              Elite Trophy Room
            </span>
          </motion.div>
          <div className="space-y-2">
            <h2 className="text-5xl font-black tracking-tight leading-none">Your Legacy</h2>
            {profile?.active_title && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 pt-2"
              >
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Current Title:
                </span>
                <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-black uppercase tracking-tight border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                  {profile.active_title}
                </span>
              </motion.div>
            )}
          </div>
          <p className="text-slate-400 max-w-xl text-lg font-medium leading-relaxed">
            The path of a professional trader is built on discipline and research. 
            Earn your titles and showcase your mastery to the community.
          </p>
        </div>
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-600/20 blur-[120px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 blur-[100px] -ml-32 -mb-32 rounded-full" />
      </div>

      {(["Psychology", "Performance", "Knowledge"] as const).map((category, idx) => (
        <motion.section 
          key={category} 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="space-y-8"
        >
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-slate-900 flex items-center justify-center text-white shadow-lg">
              {CATEGORY_ICONS[category]}
            </div>
            <h3 className="text-xl font-black text-slate-800 uppercase tracking-widest">
              {category}
            </h3>
            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {achievements
              .filter((a) => a.category === category)
              .map((achievement) => (
                <AchievementCard
                  key={achievement.key}
                  achievement={achievement}
                  isActive={profile?.active_title === achievement.title}
                />
              ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
}

function AchievementCard({ achievement, isActive }: { achievement: any; isActive: boolean }) {
  const queryClient = useQueryClient();
  const isDiamond = achievement.level === "Diamond";
  const progressPercent = Math.min((achievement.progress / achievement.target) * 100, 100);

  const getTierStyles = (level: string) => {
    switch (level) {
      case "Bronze":
        return {
          card: "bg-gradient-to-br from-orange-100/40 to-white border-orange-200/50",
          container: "bg-gradient-to-br from-orange-600 to-amber-800 shadow-[0_0_20px_rgba(194,65,12,0.25)]",
          icon: "text-orange-50",
          badge: "bg-orange-100 border-orange-200 text-orange-800",
          bar: "bg-orange-600",
          title: "text-orange-950",
          desc: "text-orange-900/60",
        };
      case "Silver":
        return {
          card: "bg-gradient-to-br from-slate-100/40 to-white border-slate-200",
          container: "bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_0_20px_rgba(71,85,105,0.2)]",
          icon: "text-slate-50",
          badge: "bg-slate-100 border-slate-200 text-slate-700",
          bar: "bg-slate-500",
          title: "text-slate-900",
          desc: "text-slate-700/60",
        };
      case "Gold":
        return {
          card: "bg-gradient-to-br from-yellow-100/60 to-white border-yellow-300 shadow-yellow-200/40",
          container: "bg-gradient-to-br from-yellow-400 via-yellow-500 to-yellow-600 shadow-[0_0_25px_rgba(234,179,8,0.4)]",
          icon: "text-yellow-50",
          badge: "bg-yellow-300 border-yellow-400 text-yellow-900 font-bold",
          bar: "bg-yellow-500 shadow-[0_0_12px_rgba(234,179,8,0.3)]",
          title: "text-yellow-950",
          desc: "text-yellow-900/60",
        };
      case "Diamond":
        return {
          card: "bg-[#0f172a] border-blue-500/30 shadow-blue-900/20",
          container: "bg-gradient-to-br from-blue-400 via-blue-600 to-indigo-700 shadow-[0_0_25px_rgba(37,99,235,0.4)] animate-pulse-subtle",
          icon: "text-blue-50",
          badge: "bg-blue-500/20 border-blue-500/30 text-blue-300",
          bar: "bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]",
          title: "text-white",
          desc: "text-blue-100/60",
        };
      default:
        return {
          card: "bg-white border-slate-200",
          container: "bg-slate-100 border border-slate-200",
          icon: "text-slate-300",
          badge: "bg-slate-100 border-slate-200 text-slate-400",
          bar: "bg-slate-200",
          title: "text-slate-800",
          desc: "text-slate-500",
        };
    }
  };

  const styles = getTierStyles(achievement.level);

  const setTitleMutation = useMutation({
    mutationFn: async (title: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { error } = await supabase
        .from("profiles")
        .update({ active_title: title })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Active title updated!");
    },
  });

  return (
    <motion.div
      whileHover={{ y: -8, scale: 1.01 }}
      className={`rounded-[32px] p-8 shadow-sm border flex flex-col gap-6 relative overflow-hidden group transition-all duration-500 ${styles.card}`}
    >
      {/* Dynamic Background Glow for high levels */}
      {achievement.level !== "None" && achievement.level !== "Bronze" && (
        <div className={`absolute -top-24 -left-24 w-48 h-48 blur-[80px] opacity-20 transition-all duration-700 group-hover:scale-150 ${
          achievement.level === "Diamond" ? "bg-blue-500" : achievement.level === "Gold" ? "bg-yellow-500" : "bg-slate-400"
        }`} />
      )}

      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-6">
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            className={`w-16 h-16 rounded-[22px] flex items-center justify-center transition-transform duration-500 ${styles.container}`}
          >
            <div className={`${styles.icon} scale-110 drop-shadow-md`}>
              {achievement.icon}
            </div>
          </motion.div>
          
          <div className="space-y-1.5">
            <h4 className={`text-xl font-black leading-tight tracking-tight ${styles.title}`}>
              {achievement.name}
            </h4>
            <div className="flex items-center gap-3">
              <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border shadow-sm ${styles.badge}`}>
                {achievement.level === "None" ? "Locked" : achievement.level}
              </span>
              
              {isDiamond && (
                <div className="relative overflow-hidden group/title rounded-lg">
                  <button
                    onClick={() => setTitleMutation.mutate(achievement.title)}
                    className={`relative flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest transition-all overflow-hidden ${
                      isActive 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" 
                        : "bg-slate-100 text-slate-500 hover:bg-blue-500 hover:text-white"
                    }`}
                  >
                    {/* Shimmer Effect for Diamond Title */}
                    <motion.div
                      animate={{ x: ["-100%", "100%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent skew-x-12"
                    />
                    <span className="relative z-10 flex items-center gap-1">
                      {isActive ? <Check className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                      {isActive ? "Active Title" : `Unlock: ${achievement.title}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {achievement.level !== "None" && (
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center border border-emerald-100 shadow-sm"
          >
            <CheckCircle2 className="w-6 h-6" />
          </motion.div>
        )}
      </div>

      <p className={`text-sm font-medium leading-relaxed relative z-10 pr-4 ${styles.desc}`}>
        {achievement.description}
      </p>

      <div className="space-y-3 relative z-10 mt-auto">
        <div className="flex justify-between items-end">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Progress Tracking
          </span>
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-black text-slate-800">
              {Math.round(achievement.progress).toLocaleString()}
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              / {achievement.target.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50 p-0.5">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 1.5, ease: "circOut" }}
            className={`h-full rounded-full relative overflow-hidden ${styles.bar}`}
          >
            {/* Subtle light effect on progress bar */}
            <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
