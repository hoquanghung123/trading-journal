import { useEffect, useMemo } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, X, Check } from "lucide-react";
import { format, addDays } from "date-fns";
import { journalTradingDate } from "@/lib/journal";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  streakCount: number;
  streakDays: string[]; // List of YYYY-MM-DD strings that are completed
}

export function CelebrationModal({ isOpen, onClose, streakCount, streakDays }: Props) {
  useEffect(() => {
    if (isOpen) {
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval: any = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Option C: Hybrid 7-day strip (Today at position 5, 2 future days)
  const weekStrip = useMemo(() => {
    const [y, m, d] = journalTradingDate().split("-").map(Number);
    const today = new Date(y, m - 1, d);
    const days = [];
    for (let i = -4; i <= 2; i++) {
      days.push(addDays(today, i));
    }
    return days;
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
          />

          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative bg-card rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden border border-border"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-8 text-center space-y-6">
              {/* Flame Ring */}
              <div className="relative inline-block mt-4">
                <div className="w-32 h-32 rounded-full border-[10px] border-orange-100 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-5xl font-black text-orange-500 leading-none">
                      {streakCount}
                    </span>
                    <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest mt-1">
                      Day Streak!
                    </span>
                  </motion.div>
                </div>

                <motion.div
                  animate={{ y: [0, -6, 0], rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute -bottom-1 -right-1 bg-orange-500 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/40"
                >
                  <Flame className="w-6 h-6 text-white fill-white" />
                </motion.div>
              </div>

              {/* Weekly Strip */}
              <div className="bg-muted/50 rounded-3xl p-5 border border-border space-y-4">
                <div className="flex justify-between items-center px-1">
                  {weekStrip.map((day, i) => {
                    const dateStr = format(day, "yyyy-MM-dd");
                    const completed = streakDays.includes(dateStr);
                    const isTodayDay = dateStr === journalTradingDate();

                    return (
                      <div key={i} className="flex flex-col items-center gap-2">
                        <span
                          className={`text-[10px] font-black uppercase tracking-tighter ${
                            isTodayDay ? "text-orange-500" : "text-muted-foreground"
                          }`}
                        >
                          {format(day, "eeeeee")}
                        </span>
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.5 + i * 0.1 }}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            completed
                              ? "bg-orange-500 text-white shadow-sm"
                              : isTodayDay
                                ? "border-2 border-orange-500 bg-card"
                                : "bg-muted"
                          }`}
                        >
                          {completed && <Check className="w-4 h-4" strokeWidth={4} />}
                        </motion.div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] font-bold text-muted-foreground leading-tight px-2">
                  A <span className="text-orange-500">streak</span> counts how many days you've
                  completed HTF prep in a row
                </p>
              </div>

              <div className="space-y-4">
                <h2 className="text-2xl font-black text-foreground tracking-tight">
                  Consistency is Key!
                </h2>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-orange-500/20 transition-all active:scale-95 uppercase tracking-widest text-sm"
              >
                Continue
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
