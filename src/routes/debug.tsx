import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/debug")({
  component: DebugComponent,
});

function DebugComponent() {
  return (
    <div className="p-8 font-mono">
      <h1 className="text-2xl mb-4">Debug Environment</h1>
      <pre className="bg-muted p-4 rounded overflow-auto">
        {JSON.stringify({
          importMetaEnv: Object.keys(import.meta.env).reduce((acc, key) => {
            acc[key] = key.includes("KEY") || key.includes("SECRET") ? "***" : import.meta.env[key];
            return acc;
          }, {} as any),
          hasProcess: typeof process !== "undefined",
          processEnvKeys: typeof process !== "undefined" ? Object.keys(process.env).filter(k => !k.includes("KEY") && !k.includes("SECRET")) : [],
        }, null, 2)}
      </pre>
    </div>
  );
}
