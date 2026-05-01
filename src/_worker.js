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

      // Intercept fetch to debug internal calls
      const originalFetch = globalThis.fetch;
      // @ts-ignore
      globalThis.fetch = async (input, init) => {
        const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
        console.log("Internal Fetch call:", url);
        try {
          const res = await originalFetch(input, init);
          if (!res.ok) console.warn("Internal Fetch failed:", url, res.status);
          return res;
        } catch (err) {
          console.error("Internal Fetch CRASHED:", url, err.message);
          throw err;
        }
      };

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

      const response = await server.fetch(request, env, ctx);
      
      // If we got a 500 HTTPError, let's try to see if we can provide more info
      if (response.status === 500) {
        const clonedRes = response.clone();
        try {
          const body = await clonedRes.json();
          if (body.message === 'HTTPError') {
            console.error("DETECTED HTTPError from Server Entry");
          }
        } catch (e) {}
      }

      return response;
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
