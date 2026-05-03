import { useEffect, useState, useMemo } from "react";
import { 
  fetchEntries, 
  calculateStreak, 
  type DayEntry, 
  type StreakStats,
  ddmm
} from "@/lib/journal";
import { motion } from "framer-motion";
import { Flame, Trophy, Calendar, Target, ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
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
  endOfWeek
} from "date-fns";

export function ProgressView() {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

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
            <Link to="/" className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-800 tracking-tight">Progress Tracker</h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Mastery through consistency</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
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
                  animate={{ strokeDashoffset: 502.6 * (1 - Math.min(stats.currentStreak / 30, 1)) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  className="text-orange-500"
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-6xl font-black text-slate-800 leading-none">{stats.currentStreak}</span>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Days</span>
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
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">Your Streak is on Fire!</h2>
                <p className="text-slate-500 font-medium mt-2">
                  {stats.isTodayComplete 
                    ? "You've completed your prep for today. Keep it up tomorrow!"
                    : "Finish your Weekly, Daily, and H4 Asian markup to maintain your streak."}
                </p>
              </div>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                <StatCard icon={<Trophy className="w-4 h-4" />} label="Best Streak" value={`${stats.longestStreak} Days`} color="text-yellow-500" />
                <StatCard icon={<Target className="w-4 h-4" />} label="Monthly Goal" value={`${stats.streakDays.length}/20`} color="text-blue-500" />
              </div>
            </div>
          </div>

          {/* Quick Checklist */}
          <div className="bg-slate-800 rounded-[40px] p-8 shadow-xl text-white space-y-6">
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-400">Daily Checklist</h3>
            <div className="space-y-4">
              <CheckItem label="Weekly Outlook" completed={entries.some(e => isToday(new Date(e.date + "T00:00:00")) && !!e.weeklyImg)} />
              <CheckItem label="Daily Direction" completed={entries.some(e => isToday(new Date(e.date + "T00:00:00")) && !!e.dailyImg)} />
              <CheckItem label="H4 Asian Structure" completed={entries.some(e => isToday(new Date(e.date + "T00:00:00")) && !!e.h4["ASIA"]?.img)} />
            </div>
            <div className="pt-4 border-t border-slate-700">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                * Complete all three to earn a streak point for today.
              </p>
            </div>
          </div>
        </section>

        {/* Streak Calendar */}
        <section className="bg-white rounded-[40px] p-10 shadow-sm border border-slate-200 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight">Consistency Calendar</h3>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-black uppercase tracking-widest min-w-[120px] text-center">
                {format(currentMonth, "MMMM yyyy")}
              </span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
              <div key={d} className="text-center py-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
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
                  className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative transition-all border ${
                    isStreak 
                      ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" 
                      : today
                        ? "bg-white border-orange-500 text-orange-500"
                        : isCurrMonth
                          ? "bg-slate-50 border-slate-100 text-slate-400"
                          : "bg-transparent border-transparent text-slate-200"
                  }`}
                >
                  <span className="text-sm font-black">{format(day, "d")}</span>
                  {isStreak && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center"
                    >
                      <Flame className="w-2.5 h-2.5 text-orange-500 fill-orange-500" />
                    </motion.div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode, label: string, value: string, color: string }) {
  return (
    <div className="bg-slate-50 px-5 py-4 rounded-2xl border border-slate-100 flex items-center gap-4 min-w-[140px]">
      <div className={`w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
        <p className="text-lg font-black text-slate-800">{value}</p>
      </div>
    </div>
  );
}

function CheckItem({ label, completed }: { label: string, completed: boolean }) {
  return (
    <div className="flex items-center gap-4 group">
      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
        completed 
          ? "bg-orange-500 border-orange-500 text-white" 
          : "border-slate-600 group-hover:border-slate-500"
      }`}>
        {completed && <Plus className="w-4 h-4" strokeWidth={4} />}
      </div>
      <span className={`text-sm font-bold transition-all ${completed ? "text-white" : "text-slate-400"}`}>
        {label}
      </span>
    </div>
  );
}
