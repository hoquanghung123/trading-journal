/**
 * Cloudflare Pages SSR Worker for TanStack Start
 * Version: V15.5-PROD
 */
import server from './server.js';

export default {
  async fetch(request, env, ctx) {
    try {
      // 1. Inject environment variables into global scope for SSR
      if (env.SUPABASE_URL) globalThis.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_PUBLISHABLE_KEY) globalThis.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
      if (env.SUPABASE_SERVICE_ROLE_KEY) globalThis.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.R2) globalThis.R2 = env.R2;

      const url = new URL(request.url);

      // 2. Asset & Storage Handling
      if (url.pathname.startsWith('/storage/')) {
        const debug = {
          v: "V17.7-PROD",
          path: decodeURIComponent(url.pathname.substring(9)),
          env: Object.keys(env || {}).join(","),
          sb_len: (env.SUPABASE_URL || "").length
        };

        try {
          const path = debug.path;
          let object = null;
          
          try {
            object = await env.R2.get(path);
            if (object) {
              const headers = new Headers();
              if (typeof object.writeHttpMetadata === 'function') {
                object.writeHttpMetadata(headers);
              }
              headers.set("Cache-Control", "public, max-age=31536000, immutable");
              headers.set('X-Debug-All', JSON.stringify({ ...debug, source: "R2" }));
              return new Response(object.body, { headers });
            }
          } catch (e) {
            debug.error = e.message;
          }

          // Fallback to Supabase (and trigger Sippy if R2 gets fixed)
          const supabaseUrl = env.SUPABASE_URL;
          if (!supabaseUrl) throw new Error("SUPABASE_URL missing");
          
          const baseUrl = supabaseUrl.replace(/\/$/, "");
          const targetUrl = `${baseUrl}/storage/v1/object/public/journal-charts/${path}`;
          const response = await fetch(targetUrl);
          
          if (response.ok) {
            const blob = await response.blob();
            
            // Background push to R2
            ctx.waitUntil((async () => {
              try {
                await env.R2.put(path, blob.stream(), {
                  httpMetadata: { contentType: response.headers.get('content-type') }
                });
              } catch (e) {
                console.error("Auto-migration failed:", e.message);
              }
            })());

            const headers = new Headers(response.headers);
            headers.set("Cache-Control", "public, max-age=31536000, immutable");
            headers.set('X-Debug-All', JSON.stringify({ ...debug, source: "SB-OK" }));
            return new Response(blob, { headers });
          }

          return new Response("Not Found", { 
            status: 404,
            headers: { 'X-Debug-All': JSON.stringify({ ...debug, source: "NOT-FOUND", sb_status: response.status }) }
          });

        } catch (error) {
          return new Response(error.message, { 
            status: 500,
            headers: { 'X-Debug-All': JSON.stringify({ ...debug, source: "ERROR", error: error.message }) }
          });
        }
      }

      const isAssetPath = url.pathname.startsWith('/assets/') || 
                         (url.pathname.includes('.') && !url.pathname.endsWith('.html'));
      
      const isPageRequest = url.pathname === "/" || 
                           url.pathname.endsWith(".html") || 
                           (!url.pathname.includes(".") && !url.pathname.startsWith("/_"));

      if (isAssetPath && !isPageRequest) {
        return env.ASSETS.fetch(request);
      }

      // 3. SSR for Pages
      if (isPageRequest) {
        // Fetch original SSR response
        const ssrRequest = new Request(request.url, request);
        const response = await server.fetch(ssrRequest, env, ctx);
        
        const contentType = response.headers.get("content-type") || "";
        const isJson = request.headers.get("accept")?.includes("json") || url.searchParams.has("_data");

        // Inject environment variables into HTML for Client Side
        if (response.status === 200 && contentType.includes("text/html") && !isJson) {
          let body = await response.text();
          
          if (body.includes('<html')) {
            const urlAttr = `data-supabase-url="${env.SUPABASE_URL || ''}"`;
            const keyAttr = `data-supabase-publishable-key="${env.SUPABASE_PUBLISHABLE_KEY || ''}"`;
            body = body.replace(/<html([^>]*)>/i, `<html$1 ${urlAttr} ${keyAttr}>`);
            
            return new Response(body, {
              headers: response.headers
            });
          }
        }
        return response;
      }

      return server.fetch(request, env, ctx);
    } catch (e) {
      console.error('Worker Error:', e.message);
      return new Response(`Internal Server Error`, { status: 500 });
    }
  }
};
