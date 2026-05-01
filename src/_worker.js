import server from './server.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // Inject env into globalThis for Supabase client
      // This is the most reliable way to pass env to non-request-aware code
      if (env.SUPABASE_URL) globalThis.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_PUBLISHABLE_KEY) globalThis.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
      if (env.SUPABASE_SERVICE_ROLE_KEY) globalThis.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.VITE_SUPABASE_URL) globalThis.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
      if (env.VITE_SUPABASE_ANON_KEY) globalThis.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;

      // Debug log for environment
      console.log("Worker executing request:", request.url);
      console.log("Available env keys:", Object.keys(env));

      // Direct bypass for /hello to verify worker health
      if (request.url.endsWith('/hello')) {
        return new Response(JSON.stringify({ 
          status: "ok", 
          message: "Hello from Worker Wrapper!",
          envKeys: Object.keys(env)
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return await server.fetch(request, env, ctx);
    } catch (e) {
      console.error("CRITICAL WORKER ERROR:", e);
      const errorDetail = e instanceof Error ? {
        message: e.message,
        stack: e.stack,
        name: e.name
      } : {
        message: String(e),
        keys: Object.keys(e || {})
      };

      return new Response(JSON.stringify({
        status: 500,
        unhandled: true,
        source: "worker_wrapper",
        error: errorDetail,
        envKeys: Object.keys(env)
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
};
