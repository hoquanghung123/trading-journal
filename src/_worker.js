/**
 * Cloudflare Pages SSR Worker for TanStack Start
 * Version: V14.54-DEBUG
 */
import server from './server.js';

const VERSION = 'V14.55-DEBUG';
const DIAG_VERSION = 'V14.55-DIAGNOSTICS';

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

      // 3. Determine if this is a page request that needs SSR
      const isPageRequest = url.pathname === "/" || 
                           url.pathname.endsWith(".html") || 
                           (!url.pathname.includes(".") && !url.pathname.startsWith("/_"));
      
      let response;
      try {
        if (isPageRequest) {
          diag.step = 'ssr-fetch';
          // FORCE SSR for pages
          const ssrRequest = new Request(request.url, request);
          ssrRequest.headers.delete("if-none-match");
          ssrRequest.headers.delete("if-modified-since");
          
          // 2. EXTREME ASSET PRIORITY
          if (url.pathname.startsWith("/assets/")) {
            diag.step = 'static-asset-direct';
            const assetResponse = await env.ASSETS.fetch(request);
            
            // Add diagnostic headers to asset responses too
            const assetHeaders = new Headers(assetResponse.headers);
            assetHeaders.set("X-Asset-Status", assetResponse.status.toString());
            assetHeaders.set("X-Diagnostic-Step", diag.step);
            
            // Force correct MIME types for common assets if missing
            if (url.pathname.endsWith(".js")) assetHeaders.set("Content-Type", "application/javascript");
            if (url.pathname.endsWith(".css")) assetHeaders.set("Content-Type", "text/css");

            return new Response(assetResponse.body, {
              status: assetResponse.status,
              headers: assetHeaders
            });
          }
          
          response = await server.fetch(ssrRequest, env, ctx);
        } else {
          // Fallback for other files (images, icons, etc.)
          diag.step = 'static-fallback';
          response = await env.ASSETS.fetch(request);
          if (!response.ok && response.status === 404 && !url.pathname.includes(".")) {
            // If asset not found and it looks like a route, try SSR one last time
            diag.step = 'ssr-last-resort';
            response = await server.fetch(request, env, ctx);
          }
        }
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
      
      // 5. Final Response Processing & Injection
      const contentType = response.headers.get("content-type") || "";
      const isHtmlResponse = contentType.includes("text/html") || isPageRequest;

      if (isHtmlResponse) {
        diag.step = 'body-inspection';
        let body = await response.text();
        
        const bodyLength = body.length;
        
        if (!body || bodyLength < 10) {
          diag.step = 'emergency-fallback';
          console.error(`${VERSION} EMPTY SSR BODY DETECTED! Status: ${response.status}`);
          body = `
            <!DOCTYPE html>
            <html>
              <head><title>Worker Emergency Fallback</title></head>
              <body style="font-family: sans-serif; padding: 2rem; background: #fff0f0; color: #900;">
                <h1>⚠️ SSR Return Empty Body (${VERSION})</h1>
                <p>The server returned a 200 status but the body was empty.</p>
                <hr/>
                <p><strong>Diagnostic Info:</strong></p>
                <ul>
                  <li>Status: ${response.status}</li>
                  <li>Step: ${diag.step}</li>
                  <li>URL: ${request.url}</li>
                  <li>Time: ${new Date().toISOString()}</li>
                </ul>
                <button onclick="window.location.reload()">Try Again (Force Refresh)</button>
              </body>
            </html>
          `;
        } else {
          diag.step = 'html-processing';
          
          // Enhanced Visual Debugger & DOM Inspection
          const statusBanner = `
            <div id="worker-status-banner" style="position:fixed;top:0;left:0;right:0;background:#1a1a1a;color:#00ff00;padding:4px 10px;font-family:monospace;font-size:11px;z-index:999999;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;">
              <span>🏗️ WORKER ${VERSION}: HTML Loaded (Waiting for JS...)</span>
              <span id="hydration-status" style="color:#ffcc00;">⏳ Checking Hydration...</span>
            </div>
          `;

          const injectedScript = `
            <script>
              console.log("🚀 [${VERSION}] HTML RECEIVED - Length: ${body.length}");
              
              window.ENV = {
                SUPABASE_URL: "${env.SUPABASE_URL || ""}",
                SUPABASE_PUBLISHABLE_KEY: "${env.SUPABASE_PUBLISHABLE_KEY || ""}"
              };

              document.addEventListener('DOMContentLoaded', () => {
                const root = document.getElementById('root') || document.getElementById('app') || document.body;
                const status = document.getElementById('hydration-status');
                const banner = document.getElementById('worker-status-banner');

                if (root) {
                  console.log("📦 [${VERSION}] Root/Body detected. Monitoring for hydration...");
                  
                  const getPureContentLength = () => {
                    const clone = root.cloneNode(true);
                    const b = clone.querySelector('#worker-status-banner');
                    if (b) b.remove();
                    return clone.innerHTML.length;
                  };

                  const initialLength = getPureContentLength();
                  
                  const checkHydration = () => {
                    const currentLength = getPureContentLength();
                    // Hydration marked by significant content change or router activity
                    if (currentLength > initialLength + 50 || window.__TSR_ROUTER__) {
                      if (status) status.innerText = "✅ Hydrated";
                      if (status) status.style.color = "#00ff00";
                      setTimeout(() => { if(banner) banner.style.display = 'none'; }, 2000);
                    } else {
                      setTimeout(checkHydration, 500);
                    }
                  };
                  checkHydration();

                  setTimeout(() => {
                    if (status && status.innerText.includes("⏳")) {
                      status.innerText = "⚠️ Hydration Status Unknown";
                      status.style.color = "#ffcc00";
                    }
                  }, 8000);
                }
              });
            </script>
          `;
          
          // Inject script in head
          if (body.includes('</head>')) {
            body = body.replace('</head>', `${injectedScript}</head>`);
          } else {
            body = body + injectedScript;
          }

          // Inject banner at start of body
          if (body.includes('<body>')) {
            body = body.replace('<body>', '<body>' + statusBanner);
          } else if (body.includes('<body ')) {
            body = body.replace(/(<body[^>]*>)/i, '$1' + statusBanner);
          }
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.delete("content-encoding");
        newHeaders.delete("content-length");
        newHeaders.set("Content-Type", "text/html; charset=utf-8");
        newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
        
        newHeaders.set("X-Diagnostic-Step", diag.step);
        newHeaders.set("X-Diagnostic-Status", response.status.toString());
        newHeaders.set("X-Response-Time", `${Date.now() - diag.start}ms`);
        newHeaders.set("X-Final-Step", "html-delivered");

        return new Response(body, {
          status: response.status,
          headers: newHeaders
        });
      }

      // For non-HTML responses
      const finalHeaders = new Headers(response.headers);
      finalHeaders.set("X-Diagnostic-Step", diag.step);
      finalHeaders.set("X-Diagnostic-Status", response.status.toString());
      finalHeaders.set("X-Final-Step", "asset-delivered");
      
      return new Response(response.body, {
        status: response.status,
        headers: finalHeaders
      });
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
