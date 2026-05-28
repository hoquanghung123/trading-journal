import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { syncToOneDrive } from "../lib/onedrive";

const getServerEnv = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const request = getRequest();
    // @ts-ignore
    const env = request?.context?.cloudflare?.env || request?.context || (globalThis as any) || {};

    const check = (key: string) => !!(env[key] || (globalThis as any)[key]);

    return {
      timestamp: new Date().toISOString(),
      hasCloudflareContext: !!request?.context?.cloudflare,
      variablesPresent: {
        SUPABASE_URL: check("SUPABASE_URL") || check("VITE_SUPABASE_URL"),
        SUPABASE_PUBLISHABLE_KEY:
          check("SUPABASE_PUBLISHABLE_KEY") || check("VITE_SUPABASE_ANON_KEY"),
        SUPABASE_SERVICE_ROLE_KEY: check("SUPABASE_SERVICE_ROLE_KEY"),
        R2_BINDING: check("R2"),
      },
      allEnvKeys: Object.keys(env).filter(
        (k) => !k.includes("KEY") && !k.includes("SECRET") && !k.includes("PASSWORD"),
      ),
      nodeVersion: typeof process !== "undefined" ? process.version : "unknown",
    };
  } catch (e: any) {
    return { error: e.message, stack: e.stack };
  }
});

const testOneDriveSync = createServerFn({ method: "POST" }).handler(async () => {
  try {
    const request = getRequest();
    // @ts-ignore
    const env = request?.context?.cloudflare?.env || request?.context || (globalThis as any) || {};
    
    const configStr = env.RCLONE_CONFIG_ONEDRIVE;
    if (!configStr) {
      throw new Error("RCLONE_CONFIG_ONEDRIVE not found in env or globalThis.");
    }
    
    const testPath = `debug_test_${Date.now()}.txt`;
    const testContent = new TextEncoder().encode("Real-time OneDrive sync debug test content.");
    
    await syncToOneDrive(testPath, testContent, "text/plain", configStr);
    
    return { success: true, message: `Dispatched sync for ${testPath}. Please check public.realtime_sync_logs in Supabase.` };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
});

export const Route = createFileRoute("/debug")({
  loader: async () => getServerEnv(),
  component: DebugComponent,
});

function DebugComponent() {
  const serverData = Route.useLoaderData() || { message: "No server data" };
  const [testResult, setTestResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleTestSync = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const res = await testOneDriveSync();
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, error: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 font-mono">
      <h1 className="text-2xl mb-4">Debug Environment</h1>

      <section className="mb-8">
        <h2 className="text-xl mb-4 text-primary font-bold">OneDrive Real-time Sync Test</h2>
        <div className="bg-card border border-border p-6 rounded-lg mb-4">
          <p className="text-sm mb-4">
            Click the button below to trigger a simulated OneDrive sync from the production worker:
          </p>
          <button
            onClick={handleTestSync}
            disabled={loading}
            className="px-4 py-2 bg-primary text-white font-bold rounded hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {loading ? "Testing..." : "Trigger OneDrive Real-time Sync Test"}
          </button>
          
          {testResult && (
            <pre className="mt-4 bg-muted p-4 rounded overflow-auto text-xs">
              {JSON.stringify(testResult, null, 2)}
            </pre>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl mb-2">Server Environment</h2>
        <pre className="bg-muted p-4 rounded overflow-auto">
          {JSON.stringify(serverData, null, 2)}
        </pre>
      </section>

      <section>
        <h2 className="text-xl mb-2">Client Environment</h2>
        <pre className="bg-muted p-4 rounded overflow-auto">
          {JSON.stringify(
            {
              importMetaEnv: Object.keys(import.meta.env).reduce((acc, key) => {
                acc[key] =
                  key.includes("KEY") || key.includes("SECRET") ? "***" : import.meta.env[key];
                return acc;
              }, {} as any),
              hasProcess: typeof process !== "undefined",
            },
            null,
            2,
          )}
        </pre>
      </section>
    </div>
  );
}
