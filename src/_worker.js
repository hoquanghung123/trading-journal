/**
 * Cloudflare Pages SSR Worker for TanStack Start
 * Version: V14.46-DEBUG
 */
import server from './server.js';

const VERSION = 'V14.46-DEBUG';
const DIAG_VERSION = 'V14.46-DIAGNOSTICS';

export default {
  async fetch(request, env, ctx) {
    const diag = { step: 'init', start: Date.now() };
    try {
      // 1. Inject environment variables into global scope
      if (env.SUPABASE_URL) globalThis.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_PUBLISHABLE_KEY) globalThis.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
      if (env.SUPABASE_SERVICE_ROLE_KEY) globalThis.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.R2) globalThis.R2 = env.R2;

      const url = new URL(request.url);

      // 2. Try to serve static assets first (CSS, JS, images from dist/client)
      try {
        // STRICT RULE: Only serve from Cloudflare Assets if it's clearly a static file
        // and NOT an HTML document or the root path.
        const isAssetPath = url.pathname.startsWith('/assets/') || 
                           (url.pathname.includes('.') && !url.pathname.endsWith('.html'));
        
        const isPageRequest = url.pathname === "/" || 
                             url.pathname.endsWith(".html") || 
                             !url.pathname.includes(".");

        // Force SSR for any page-like request to prevent serving the empty static index.html
        const assetResponse = (isAssetPath && !isPageRequest) 
          ? await env.ASSETS.fetch(request.clone()) 
          : { ok: false };
        
        if (assetResponse.ok) {
          diag.step = 'static-asset';
          // Add a header to identify it's a static asset
          console.log(`${VERSION} ASSET SERVED: ${url.pathname}`);
          const headers = new Headers(assetResponse.headers);
          headers.set("X-Asset-Source", "Cloudflare-Assets");
          headers.set("X-Diagnostic-Step", diag.step);
          return new Response(assetResponse.body, {
            status: assetResponse.status,
            statusText: assetResponse.statusText,
            headers
          });
        }
        
        // If it's an asset request but not found, don't fall through to SSR
        if (url.pathname.startsWith('/assets/')) {
          diag.step = 'asset-404';
          console.error(`${VERSION} ASSET NOT FOUND:`, url.pathname);
          return new Response(`Asset Not Found: ${url.pathname}`, { 
            status: 404,
            headers: { "X-Diagnostic-Step": diag.step }
          });
        }
      } catch (e) {
        console.error(`${VERSION} ASSETS.fetch error:`, e);
      }

      // 2. Direct R2 storage bypass with Supabase Fallback (Manual Sippy)
      if (url.pathname.startsWith('/storage/')) {
        const path = decodeURIComponent(url.pathname.substring(9));
        const r2 = env.R2;
        if (r2) {
          // Try R2 first, but wrap in try/catch because Sippy can throw "Access Denied" for non-existent files
          try {
            const object = await r2.get(path);
            if (object) {
              console.log(`[R2] Found "${path}" in R2`);
              const headers = new Headers();
              object.writeHttpMetadata(headers);
              headers.set("etag", object.httpEtag);
              headers.set("Cache-Control", "public, max-age=31536000, immutable");
              headers.set("X-Storage-Source", "R2");
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
          // The actual bucket name is 'journal-charts' based on your dashboard
          const authenticatedUrl = `${SUPABASE_URL}/storage/v1/object/authenticated/journal-charts/${path}`;
          const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/journal-charts/${path}`;
          
          try {
            // Try authenticated first
            let supabaseResponse = await fetch(authenticatedUrl, {
              headers: {
                "Authorization": `Bearer ${SERVICE_KEY}`,
                "apikey": SERVICE_KEY
              }
            });

            // If 400 or 404 on authenticated, try public as fallback
            if (!supabaseResponse.ok && (supabaseResponse.status === 400 || supabaseResponse.status === 404)) {
              console.log("Authenticated fetch failed, trying public...");
              supabaseResponse = await fetch(publicUrl);
            }
            if (supabaseResponse.ok) {
              const contentType = supabaseResponse.headers.get("content-type");
              const body = await supabaseResponse.arrayBuffer();

              // Save to R2 in the background for next time
              console.log(`[R2] Starting background migration for: ${path}`);
              ctx.waitUntil(r2.put(path, body, {
                httpMetadata: { contentType: contentType || "image/png" }
              }).then(() => console.log(`[R2] Migration SUCCESS for: ${path}`))
                .catch(err => console.error(`[R2] Migration FAILED for ${path}:`, err.message)));

              // Return the image to the user
              return new Response(body, {
                headers: {
                  "Content-Type": contentType || "image/png",
                  "Cache-Control": "public, max-age=31536000, immutable",
                  "X-Storage-Source": "Supabase-Fallback",
                  "X-Migration-Status": "Migrating-To-R2"
                }
              });
            } else {
              return new Response("Object not found in Supabase", { status: 404 });
            }
          } catch (e) {
            console.error("Migration fallback failed:", e);
            return new Response("Internal Server Error", { status: 500 });
          }
        }
        return new Response("R2 binding not configured", { status: 500 });
      }

      // 4. Fallback to SSR (TanStack Start)
      diag.step = 'ssr-fetch';
      let response;
      try {
        // Create a new request based on the original but strip cache headers
        // to force a fresh SSR render (prevents blank 304 responses)
        const ssrRequest = new Request(request.url, request);
        ssrRequest.headers.delete("if-none-match");
        ssrRequest.headers.delete("if-modified-since");
        // Add a unique ID to break any internal server-side caching
        ssrRequest.headers.set("X-Unique-ID", crypto.randomUUID());
        
        response = await server.fetch(ssrRequest, env, ctx);
      } catch (e) {
        diag.step = 'ssr-error';
        console.error("SSR Fetch Error:", e);
        // Distinguish between RPC/data requests and UI requests to prevent client crashes
        const isJson = request.headers.get("accept")?.includes("application/json") || 
                       request.headers.get("x-tanstack-start-rpc") || 
                       url.pathname.includes("/_rpc/");
        
        if (isJson) {
          return new Response(JSON.stringify({ error: "Internal Server Error", message: e.message }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
          });
        }
        return new Response("Internal Server Error", { status: 500 });
      }
      
      // 5. Inject environment variables into HTML for client-side Supabase client
      if (response.headers.get("content-type")?.includes("text/html")) {
        diag.step = 'html-injection';
        let body = await response.text();
        
        if (!body || body.length < 10) {
          console.error(`${VERSION} EMPTY SSR BODY DETECTED - Status: ${response.status}`);
          diag.step = 'empty-body';
          // If body is empty, provide a minimal fallback to avoid white screen
          body = `<!DOCTYPE html><html><head><title>Trading Journal - Loading</title></head><body><div id="root">Loading... (SSR Empty Fallback)</div></body></html>`;
        }

        const injectedScript = `
          <script>
            window.ENV = {
              SUPABASE_URL: "${env.SUPABASE_URL || ""}",
              SUPABASE_PUBLISHABLE_KEY: "${env.SUPABASE_PUBLISHABLE_KEY || ""}"
            };
          </script>
        `;
        
        // Ensure we have a </head> tag to replace, or append if missing
        let newBody;
        if (body.includes('</head>')) {
          newBody = body.replace('</head>', `${injectedScript}</head>`);
        } else {
          newBody = body + injectedScript;
        }

        const newHeaders = new Headers(response.headers);
        // CRITICAL: Remove encoding and length headers when body is modified
        // This prevents decoding errors in Chrome (white screen)
        newHeaders.delete("content-encoding");
        newHeaders.delete("content-length");
        
        // FORCE NO CACHE
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
        newHeaders.set("Pragma", "no-cache");
        newHeaders.set("Expires", "0");
        // Clear site data to force browser to drop any old cached versions
        newHeaders.set("Clear-Site-Data", "\"cache\"");
        
        newHeaders.set("X-Diagnostic-Step", diag.step);
        newHeaders.set("X-Diagnostic-Status", response.status.toString());
        newHeaders.set("X-Response-Time", `${Date.now() - diag.start}ms`);
        newHeaders.set("X-Body-Length", body.length.toString());
        newHeaders.set("X-Body-Snippet", body.substring(0, 50).replace(/[\n\r]/g, ' '));

        response = new Response(newBody, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      } else {
        // For non-HTML responses
        const newHeaders = new Headers(response.headers);
        newHeaders.set("X-Diagnostic-Step", diag.step);
        newHeaders.set("X-Diagnostic-Status", response.status.toString());
        response = new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders
        });
      }

      return response;
    } catch (e) {
      console.error(`${VERSION} FATAL_ERROR:`, e);
      
      return new Response(JSON.stringify({
        status: 500,
        unhandled: true,
        version: VERSION,
        message: e.message || "Internal Server Error",
        stack: e.stack,
        request_info: {
          url: request.url,
          method: request.method
        }
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }
};
