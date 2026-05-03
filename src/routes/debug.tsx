import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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

export const Route = createFileRoute("/debug")({
  loader: async () => getServerEnv(),
  component: DebugComponent,
});

function DebugComponent() {
  const serverData = Route.useLoaderData() || { message: "No server data" };

  return (
    <div className="p-8 font-mono">
      <h1 className="text-2xl mb-4">Debug Environment</h1>

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
