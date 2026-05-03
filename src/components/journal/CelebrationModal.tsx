import { useEffect } from "react";
import confetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, X } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  streakCount: number;
}

export function CelebrationModal({ isOpen, onClose, streakCount }: Props) {
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
            className="relative bg-white rounded-[40px] shadow-2xl w-full max-w-sm overflow-hidden"
          >
            <button
              onClick={onClose}
              className="absolute top-6 right-6 w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="p-10 text-center space-y-8">
              {/* Flame Ring */}
              <div className="relative inline-block">
                <div className="w-48 h-48 rounded-full border-[12px] border-orange-100 flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.2, type: "spring" }}
                    className="flex flex-col items-center"
                  >
                    <span className="text-7xl font-black text-orange-500 leading-none">
                      {streakCount}
                    </span>
                    <span className="text-xl font-bold text-orange-400 uppercase tracking-widest mt-1">
                      {streakCount === 1 ? "Day" : "Days"}
                    </span>
                  </motion.div>
                </div>
                
                {/* Floating Flame Icon */}
                <motion.div
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="absolute -bottom-2 -right-2 bg-orange-500 w-16 h-16 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/40"
                >
                  <Flame className="w-8 h-8 text-white fill-white" />
                </motion.div>
              </div>

              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">
                  Prep Goal Complete!
                </h2>
                <p className="text-slate-500 font-medium leading-relaxed">
                  You've met your daily goal! Consistent HTF prep is the key to trading mastery. Keep the fire burning!
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-orange-500/20 transition-all active:scale-95 uppercase tracking-widest"
              >
                Continue Streak
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
