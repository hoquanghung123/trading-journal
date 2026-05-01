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

      // 1. Check for Node.js compatibility
      const hasProcess = typeof process !== 'undefined';
      const hasAsyncLocalStorage = typeof ReadableStream !== 'undefined'; // Just a placeholder check
      console.log("Environment Check:", { hasProcess, nodeVersion: hasProcess ? process.version : 'N/A' });

      // 2. Capture console.error to find the real cause of HTTPError
      let lastErrorMessage = "";
      const originalConsoleError = console.error;
      console.error = (...args) => {
        lastErrorMessage += args.map(a => String(a)).join(' ') + "\n";
        originalConsoleError.apply(console, args);
      };

      // Direct bypass for /hello to verify worker health
      if (request.url.endsWith('/hello')) {
        return new Response(JSON.stringify({ 
          status: "ok", 
          message: "Hello from Worker Wrapper!",
          envKeys: Object.keys(env),
          diagnostics: { hasProcess, nodeVersion: hasProcess ? process.version : 'N/A' }
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const response = await server.fetch(request, env, ctx);
      
      // 3. If we got a 500 HTTPError, swap the response with our diagnostic info
      if (response.status === 500) {
        return new Response(JSON.stringify({
          status: 500,
          message: "DIAGNOSTIC REPORT",
          lastConsoleError: lastErrorMessage || "No console error captured",
          envKeys: Object.keys(env),
          url: request.url
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
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
