// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv, type ConfigEnv } from "vite";
import { localBiasStorePlugin } from "./scripts/local-bias-store";

const baseConfig = defineConfig({
  vite: {
    build: { rollupOptions: { external: ["cloudflare:workers"] } },
  },
});

export default async (configEnv: ConfigEnv) => {
  // Server functions need private settings during local development. Never
  // expose these through Vite's client-side `define` or VITE_* variables.
  if (configEnv.command === "serve") {
    const env = loadEnv(configEnv.mode, process.cwd(), "");
    for (const key of ["LMS_BIAS_LOCAL_ARCHIVE_URL", "LMS_BIAS_ENABLED", "LMS_BIAS_URL", "LMS_BIAS_SECRET", "TRADING_JOURNAL_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_ANON_KEY"]) {
      if (env[key] && process.env[key] === undefined) process.env[key] = env[key];
    }
  }
  const config = await baseConfig(configEnv);
  if (configEnv.command === "serve" && process.env.LMS_BIAS_LOCAL_ARCHIVE_URL) {
    config.plugins ||= [];
    config.plugins.push(localBiasStorePlugin(process.env.LMS_BIAS_SECRET || ""));
  }
  return config;
};
