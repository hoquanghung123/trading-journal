import { useEffect, useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEntries,
  calculateStreak,
  type DayEntry,
  type StreakStats,
  ddmm,
} from "@/lib/journal";
import { motion } from "framer-motion";
import {
  Flame,
  Trophy,
  Calendar,
  Target,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Users,
  Award,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Leaderboard } from "./Leaderboard";
import { AchievementsView } from "./AchievementsView";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
} from "date-fns";

export function ProgressView() {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"progress" | "leaderboard" | "achievements">(
    "progress",
  );

  useEffect(() => {
    fetchEntries()
      .then((data) => {
        setEntries(data);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  const stats = useMemo(() => calculateStreak(entries), [entries]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Progress Tracker</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                Mastery through consistency
              </p>
            </div>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab("progress")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${
                activeTab === "progress"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Target className="w-4 h-4" />
              Progress
            </button>
            <button
              onClick={() => setActiveTab("achievements")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${
                activeTab === "achievements"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Award className="w-4 h-4" />
              Achievements
            </button>
            <button
              onClick={() => setActiveTab("leaderboard")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tight transition-all ${
                activeTab === "leaderboard"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Users className="w-4 h-4" />
              Leaderboard
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {activeTab === "progress" ? (
          <>
            {/* Streak Circle Hero */}
            <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 bg-white rounded-[40px] p-10 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-10">
                <div className="relative">
                  <svg className="w-48 h-48 -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="80"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      className="text-slate-100"
                    />
                    <motion.circle
                      cx="96"
                      cy="96"
                      r="80"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="12"
                      strokeDasharray={502.6}
                      initial={{ strokeDashoffset: 502.6 }}
                      animate={{
                        strokeDashoffset: 502.6 * (1 - Math.min(stats.currentStreak / 30, 1)),
                      }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="text-orange-500"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-6xl font-black text-slate-800 leading-none">
                      {stats.currentStreak}
                    </span>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                      Days
                    </span>
                  </div>
                  <motion.div
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute -bottom-2 -right-2 w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/30"
                  >
                    <Flame className="w-6 h-6 text-white fill-white" />
                  </motion.div>
                </div>

                <div className="flex-1 space-y-6 text-center md:text-left">
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                      Your Streak is on Fire!
                    </h2>
                    <p className="text-slate-500 font-medium mt-2">
                      {stats.isTodayComplete
                        ? "You've completed your prep for today. Keep it up tomorrow!"
                        : "Finish your Weekly, Daily, and H4 Asian markup to maintain your streak."}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-4">
                    <StatCard
                      icon={<Trophy className="w-4 h-4" />}
                      label="Best Streak"
                      value={`${stats.longestStreak} Days`}
                      color="text-yellow-500"
                    />
                    <StatCard
                      icon={<Target className="w-4 h-4" />}
                      label="Monthly Goal"
                      value={`${stats.streakDays.length}/20`}
                      color="text-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Consistency Calendar */}
              <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                      Consistency
                    </h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest min-w-[80px] text-center text-slate-600">
                      {format(currentMonth, "MMM yyyy")}
                    </span>
                    <button
                      onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                      className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                    <div
                      key={d}
                      className="text-center py-1 text-[9px] font-black uppercase tracking-widest text-slate-300"
                    >
                      {d}
                    </div>
                  ))}
                  {days.map((day, i) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const isStreak = stats.streakDays.includes(dateStr);
                    const isCurrMonth = day.getMonth() === currentMonth.getMonth();
                    const today = isToday(day);

                    return (
                      <div
                        key={i}
                        className={`aspect-square flex items-center justify-center relative`}
                      >
                        {isStreak && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute inset-1 bg-orange-500 rounded-full shadow-sm shadow-orange-500/20"
                          />
                        )}
                        <span
                          className={`relative text-[11px] font-bold ${
                            isStreak
                              ? "text-white"
                              : today
                                ? "text-orange-500 underline decoration-2 underline-offset-4"
                                : isCurrMonth
                                  ? "text-slate-500"
                                  : "text-slate-200"
                          }`}
                        >
                          {format(day, "d")}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Compact Daily Status */}
                <div className="pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
                  <CompactCheck
                    label="W"
                    active={entries.some(
                      (e) => isToday(new Date(e.date + "T00:00:00")) && !!e.weeklyImg,
                    )}
                  />
                  <CompactCheck
                    label="D"
                    active={entries.some(
                      (e) => isToday(new Date(e.date + "T00:00:00")) && !!e.dailyImg,
                    )}
                  />
                  <CompactCheck
                    label="H4"
                    active={entries.some(
                      (e) => isToday(new Date(e.date + "T00:00:00")) && !!e.h4["ASIA"]?.img,
                    )}
                  />
                </div>
              </section>
            </section>
          </>
        ) : activeTab === "achievements" ? (
          <AchievementsView />
        ) : (
          <Leaderboard />
        )}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 flex items-center gap-4 min-w-[140px]">
      <div
        className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center ${color}`}
      >
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function CheckItem({ label, completed }: { label: string; completed: boolean }) {
  return (
    <div className="flex items-center gap-4 group">
      <div
        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
          completed
            ? "bg-orange-500 border-orange-500 text-white"
            : "border-slate-600 group-hover:border-slate-500"
        }`}
      >
        {completed && <Check className="w-4 h-4" strokeWidth={4} />}
      </div>
      <span
        className={`text-sm font-bold transition-all ${completed ? "text-white" : "text-slate-400"}`}
      >
        {label}
      </span>
    </div>
  );
}

function CompactCheck({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={`flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all ${
        active
          ? "bg-orange-50 border-orange-200 text-orange-600"
          : "bg-slate-50 border-slate-100 text-slate-300"
      }`}
    >
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
      {active ? <Check className="w-3 h-3" strokeWidth={4} /> : <div className="w-3 h-3" />}
    </div>
  );
}
