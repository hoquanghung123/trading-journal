/**
 * Cloudflare Pages SSR Worker for TanStack Start
 * Version: V15.2-PROD
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
        if (!env.R2) {
          return new Response("Storage configuration missing", { status: 500 });
        }

        try {
          const path = decodeURIComponent(url.pathname.substring(9));
          const object = await env.R2.get(path);
          
          if (object) {
            const headers = new Headers();
            if (typeof object.writeHttpMetadata === 'function') {
              object.writeHttpMetadata(headers);
            }
            headers.set("Cache-Control", "public, max-age=31536000, immutable");
            headers.set("X-Content-Source", "R2-Storage");
            return new Response(object.body, { headers });
          }

          // Fallback to Supabase Storage if missing from R2
          if (env.SUPABASE_URL) {
            const supabaseUrl = `${env.SUPABASE_URL}/storage/v1/object/public/journal-charts/${path}`;
            const sbResponse = await fetch(supabaseUrl);

            if (sbResponse.ok) {
              // Auto-migrate: save to R2 in the background
              const contentType = sbResponse.headers.get("content-type");
              ctx.waitUntil(env.R2.put(path, sbResponse.clone().body, {
                httpMetadata: { contentType: contentType || 'image/png' }
              }));

              const headers = new Headers(sbResponse.headers);
              headers.set("Cache-Control", "public, max-age=31536000, immutable");
              headers.set("X-Content-Source", "Supabase-Fallback");
              return new Response(sbResponse.body, { headers });
            }
          }

          return new Response("Object Not Found", { status: 404 });
        } catch (storageError) {
          console.error('Storage Error:', storageError.message);
          return new Response(`Storage Error: ${storageError.message}`, { status: 500 });
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
