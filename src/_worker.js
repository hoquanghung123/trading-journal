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

      // 2. Direct R2 storage bypass with Supabase Fallback (Manual Sippy)
      const url = new URL(request.url);
      if (url.pathname.startsWith('/storage/')) {
        const path = decodeURIComponent(url.pathname.substring(9));
        const r2 = env.R2;
        if (r2) {
          // Try R2 first, but wrap in try/catch because Sippy can throw "Access Denied" for non-existent files
          try {
            const object = await r2.get(path);
            if (object) {
              const headers = new Headers();
              object.writeHttpMetadata(headers);
              headers.set("etag", object.httpEtag);
              headers.set("Cache-Control", "public, max-age=31536000, immutable");
              return new Response(object.body, { headers });
            }
          } catch (e) {
            console.warn("R2 get failed (likely Sippy-related), falling back to Supabase:", e.message);
          }

          // Fallback to Supabase if not in R2
          const SUPABASE_URL = env.SUPABASE_URL;
          const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
          
          if (!SUPABASE_URL || !SERVICE_KEY) {
            return new Response("Missing Supabase configuration for migration", { status: 500 });
          }

          // Use the authenticated endpoint to support private buckets
          const supabaseUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/${path}`;
          
          try {
            const supabaseResponse = await fetch(supabaseUrl, {
              headers: {
                "Authorization": `Bearer ${SERVICE_KEY}`
              }
            });
            if (supabaseResponse.ok) {
              const contentType = supabaseResponse.headers.get("content-type");
              const body = await supabaseResponse.arrayBuffer();

              // Save to R2 in the background for next time
              ctx.waitUntil(r2.put(path, body, {
                httpMetadata: { contentType: contentType || "image/png" }
              }));

              // Return the image to the user
              return new Response(body, {
                headers: {
                  "Content-Type": contentType || "image/png",
                  "Cache-Control": "public, max-age=31536000, immutable",
                  "X-Migration-Source": "Supabase-Fallback",
                  "X-Debug-URL": supabaseUrl
                }
              });
            } else {
              // Return the error status from Supabase to help debug
              return new Response(`Supabase Error: ${supabaseResponse.status} for URL: ${supabaseUrl}`, { 
                status: supabaseResponse.status,
                headers: { "X-Debug-URL": supabaseUrl }
              });
            }
          } catch (e) {
            console.error("Migration fallback failed:", e);
            return new Response(`Migration error: ${e.message}`, { status: 500 });
          }
        }
        return new Response("R2 binding not configured", { status: 500 });
      }

      // 4. Fallback to SSR (TanStack Start)
      let response;
      try {
        response = await server.fetch(request, env, ctx);
      } catch (e) {
        return new Response(JSON.stringify({
          status: 500,
          message: "SSR CRASH",
          error: e.message,
          stack: e.stack
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
      
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

      // 6. Detailed error report for 500 responses
      if (response.status === 500) {
        const clonedResponse = response.clone();
        try {
          const errorText = await clonedResponse.text();
          return new Response(JSON.stringify({
            status: 500,
            message: "APPLICATION ERROR",
            detail: errorText,
            url: request.url
          }), { status: 500, headers: { 'Content-Type': 'application/json' } });
        } catch (e) {
          // If we can't read the error, just return the original response
        }
      }

      return response;
    } catch (e) {
      console.error("CRITICAL WORKER ERROR:", e);
      return new Response(JSON.stringify({
        status: 500,
        message: "WORKER WRAPPER CRASH",
        error: e.message,
        stack: e.stack,
        url: request.url
      }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }
  }
};
