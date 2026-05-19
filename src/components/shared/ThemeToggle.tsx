import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className="fixed top-2.5 right-4 z-50 lg:top-4 lg:right-6 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center cursor-pointer transition-all focus:outline-none border shadow-md active:scale-95 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md border-slate-200/80 dark:border-slate-800/80 text-slate-800 dark:text-slate-100 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 hover:shadow-lg dark:hover:shadow-slate-950/30"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle Night Mode"
    >
      <AnimatePresence mode="wait" initial={false}>
        {theme === "dark" ? (
          <motion.div
            key="moon"
            initial={{ rotate: -90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: 90, scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            className="flex items-center justify-center text-primary"
          >
            <Moon className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-primary/10" strokeWidth={2} />
          </motion.div>
        ) : (
          <motion.div
            key="sun"
            initial={{ rotate: 90, scale: 0, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={{ rotate: -90, scale: 0, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 15,
            }}
            className="flex items-center justify-center text-amber-500"
          >
            <Sun className="w-4.5 h-4.5 sm:w-5 sm:h-5 fill-amber-500/10" strokeWidth={2} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
