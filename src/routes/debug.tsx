import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const getServerEnv = createServerFn({ method: "GET" })
  .handler(async () => {
    const request = getRequest();
    // @ts-ignore
    const env = request?.context?.cloudflare?.env || request?.context || {};
    
    return {
      hasCloudflare: !!request?.context?.cloudflare,
      envKeys: Object.keys(env).filter(k => !k.includes("KEY") && !k.includes("SECRET")),
      processEnvKeys: typeof process !== "undefined" ? Object.keys(process.env).filter(k => !k.includes("KEY") && !k.includes("SECRET")) : [],
      globalKeys: Object.keys(globalThis).filter(k => k === "R2" || k === "MINIFLARE"),
    };
  });

export const Route = createFileRoute("/debug")({
  loader: () => getServerEnv(),
  component: DebugComponent,
});

function DebugComponent() {
  const serverData = Route.useLoaderData();
  
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
          {JSON.stringify({
            importMetaEnv: Object.keys(import.meta.env).reduce((acc, key) => {
              acc[key] = key.includes("KEY") || key.includes("SECRET") ? "***" : import.meta.env[key];
              return acc;
            }, {} as any),
            hasProcess: typeof process !== "undefined",
          }, null, 2)}
        </pre>
      </section>
    </div>
  );
}
