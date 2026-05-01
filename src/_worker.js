import server from './server.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. Inject environment variables into global scope
      if (env.SUPABASE_URL) globalThis.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_PUBLISHABLE_KEY) globalThis.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
      if (env.SUPABASE_SERVICE_ROLE_KEY) globalThis.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.R2) globalThis.R2 = env.R2;

      // 2. Try to serve static assets first (CSS, JS, images from dist/client)
      try {
        const assetResponse = await env.ASSETS.fetch(request.clone());
        if (assetResponse.ok) {
          return assetResponse;
        }
      } catch (e) {
        // Fall through to handlers
      }

      // 3. Direct R2 storage bypass for /storage/*
      const url = new URL(request.url);
      if (url.pathname.startsWith('/storage/')) {
        const path = decodeURIComponent(url.pathname.substring(9));
        const r2 = env.R2;
        if (r2) {
          const object = await r2.get(path);
          if (object) {
            const headers = new Headers();
            object.writeHttpMetadata(headers);
            headers.set("etag", object.httpEtag);
            headers.set("Cache-Control", "public, max-age=31536000, immutable");
            return new Response(object.body, { headers });
          }
        }
      }

      // 4. Fallback to SSR (TanStack Start)
      let response = await server.fetch(request, env, ctx);
      
      // 5. Inject environment variables into HTML for client-side Supabase client
      if (response.headers.get("content-type")?.includes("text/html")) {
        const body = await response.text();
        const injectedScript = `
          <script>
            window.ENV = {
              SUPABASE_URL: "${env.SUPABASE_URL || ""}",
              SUPABASE_PUBLISHABLE_KEY: "${env.SUPABASE_PUBLISHABLE_KEY || ""}"
            };
          </script>
        `;
        const newBody = body.replace('</head>', `${injectedScript}</head>`);
        response = new Response(newBody, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }

      return response;
    } catch (e) {
      console.error("Worker Error:", e);
      return new Response("Internal Server Error", { status: 500 });
    }
  }
};
