/**
 * Cloudflare Pages SSR Worker for TanStack Start
 * Version: V14.69-DEBUG
 */
import server from './server.js';

const VERSION = 'V14.69-DEBUG';

export default {
  async fetch(request, env, ctx) {
    const diag = { step: 'init', start: Date.now(), logs: [] };

    const workerLog = (msg) => {
      const time = new Date().toLocaleTimeString();
      console.log(`[${VERSION}] ${msg}`);
      diag.logs.push(`${time}: ${msg}`);
    };

    try {
      // 1. Diagnostics: Check if env variables exist
      const hasUrl = !!env.SUPABASE_URL;
      const hasKey = !!env.SUPABASE_PUBLISHABLE_KEY;
      const envKeys = Object.keys(env).join(', ');
      workerLog(`Env Check: URL=${hasUrl}, KEY=${hasKey} | Keys: ${envKeys}`);

      // 1. Inject environment variables into global scope
      if (env.SUPABASE_URL) globalThis.SUPABASE_URL = env.SUPABASE_URL;
      if (env.SUPABASE_PUBLISHABLE_KEY) globalThis.SUPABASE_PUBLISHABLE_KEY = env.SUPABASE_PUBLISHABLE_KEY;
      if (env.SUPABASE_SERVICE_ROLE_KEY) globalThis.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
      if (env.R2) globalThis.R2 = env.R2;

      const url = new URL(request.url);

      // 2. Asset Handling
      const isAssetPath = url.pathname.startsWith('/assets/') || 
                         (url.pathname.includes('.') && !url.pathname.endsWith('.html'));
      
      const isPageRequest = url.pathname === "/" || 
                           url.pathname.endsWith(".html") || 
                           (!url.pathname.includes(".") && !url.pathname.startsWith("/_"));

      // Direct R2 check for storage
      if (url.pathname.startsWith('/storage/')) {
        const path = decodeURIComponent(url.pathname.substring(9));
        if (env.R2) {
          try {
            const object = await env.R2.get(path);
            if (object) {
              const headers = new Headers();
              object.writeHttpMetadata(headers);
              headers.set("Cache-Control", "public, max-age=31536000, immutable");
              headers.set("X-Storage-Source", "R2");
              return new Response(object.body, { headers });
            }
          } catch (e) {
            workerLog(`R2 error: ${e.message}`);
          }
        }
      }

      // 3. Serve assets
      if (isAssetPath && !isPageRequest) {
        diag.step = 'static-asset';
        return env.ASSETS.fetch(request);
      }

      // 4. SSR for Pages
      if (isPageRequest) {
        diag.step = 'ssr-fetch';
        workerLog(`SSR Request: ${url.pathname}`);
        
        // Force fresh SSR by removing cache headers
        const ssrRequest = new Request(request.url, request);
        ssrRequest.headers.delete("if-none-match");
        ssrRequest.headers.delete("if-modified-since");
        
        const response = await server.fetch(ssrRequest, env, ctx);
        const contentType = response.headers.get("content-type") || "";
        const isJson = request.headers.get("accept")?.includes("json") || url.searchParams.has("_data");

        if (response.status === 200 && contentType.includes("text/html") && !isJson) {
          diag.step = 'body-injection';
          let body = await response.text();
          const origLen = body.length;

          const envStatus = (hasUrl && hasKey) ? '<span style="color:#00ff00">ENV:✅</span>' : '<span style="color:#ff4444">ENV:❌</span>';

          const statusBanner = `
            <div id="worker-status-banner" style="position:fixed;top:0;left:0;right:0;background:#1a1a1a;color:#00ff00;padding:6px 12px;font-family:monospace;font-size:11px;z-index:999999;border-bottom:1px solid #333;display:flex;justify-content:space-between;align-items:center;cursor:help;" title="Click to view full HTML source">
              <div onclick="window.showSource()" style="flex:1">
                🏗️ <b>${VERSION}</b> ${envStatus} | Status 200 (Len: ${origLen}) 
                <span id="dom-info" style="margin-left:15px;opacity:0.8;"></span>
              </div>
              <div id="hydration-status" style="color:#ffcc00;font-weight:bold;">⏳ Checking...</div>
            </div>`;

          const injectedScript = `
            <script>
              (function() {
                const logs = ["Worker logs: " + ${JSON.stringify(diag.logs)}];
                let hydrated = false;

                window.showSource = () => {
                  const pre = document.createElement('pre');
                  pre.style.cssText = 'position:fixed;top:40px;left:0;right:0;bottom:0;background:#fff;color:#000;z-index:1000000;padding:20px;overflow:auto;font-size:11px;white-space:pre-wrap;word-break:break-all;';
                  pre.innerText = document.documentElement.outerHTML;
                  const close = document.createElement('button');
                  close.innerText = 'CLOSE';
                  close.style.cssText = 'position:fixed;top:50px;right:30px;z-index:1000001;padding:12px 20px;background:#ff4444;color:white;border:none;border-radius:8px;font-weight:bold;cursor:pointer;box-shadow:0 10px 20px rgba(0,0,0,0.2);';
                  close.onclick = () => { pre.remove(); close.remove(); };
                  document.body.appendChild(pre);
                  document.body.appendChild(close);
                };

                const updateInfo = () => {
                  const info = document.getElementById('dom-info');
                  if (!info) return;
                  const root = document.body;
                  const scripts = Array.from(document.querySelectorAll('script')).length;
                  const children = Array.from(root.children).filter(c => c.id !== 'worker-status-banner' && c.tagName !== 'SCRIPT');
                  const tags = [...new Set(children.map(c => c.tagName))].join(', ');
                  const text = root.innerText.replace(/\\s+/g, ' ').trim().substring(0, 40);
                  info.innerText = "DOM: " + children.length + " [" + (tags || 'NONE') + "] | Scripts: " + scripts + " | Log: " + (logs.length > 1 ? logs.length - 1 : "No logs");
                };

                const setHydrated = (msg, color = "#00ff00") => {
                  const status = document.getElementById('hydration-status');
                  if (status) {
                    status.innerText = msg;
                    status.style.color = color;
                  }
                  hydrated = true;
                };

                // Intercept console IMMEDIATELY
                const originalLog = console.log;
                console.log = (...args) => {
                  logs.push(args.map(a => typeof a === 'object' ? 'OBJ' : String(a)).join(' '));
                  updateInfo();
                  originalLog.apply(console, args);
                };

                window.onerror = (msg) => {
                  setHydrated("❌ JS Error: " + String(msg).substring(0, 30), "#ff4444");
                  console.log("CRASH:", msg);
                };

                const observer = new MutationObserver(() => {
                  updateInfo();
                  if (!hydrated && (document.getElementById('root') || document.querySelector('[data-reactroot]'))) {
                    setHydrated("✅ Hydrated");
                  }
                });

                document.addEventListener('DOMContentLoaded', () => {
                  workerLog("DOM Content Loaded");
                  updateInfo();
                  observer.observe(document.body, { childList: true, subtree: true });
                  setTimeout(() => { if (!hydrated) setHydrated("🟢 SSR Stable"); }, 4000);
                });

                console.log("DIAGNOSTIC SCRIPT ACTIVE");
              })();
            </script>`;

          // Inject credentials into <html> tag attributes (Safest way)
          if (body.includes('<html')) {
            const urlAttr = `data-supabase-url="${env.SUPABASE_URL || ''}"`;
            const keyAttr = `data-supabase-publishable-key="${env.SUPABASE_PUBLISHABLE_KEY || ''}"`;
            body = body.replace(/<html([^>]*)>/i, `<html$1 ${urlAttr} ${keyAttr}>`);
          }

          if (body.includes('<body')) {
            body = body.replace(/(<body[^>]*>)/i, '$1' + statusBanner + injectedScript);
          } else {
            body = statusBanner + injectedScript + body;
          }

          const newHeaders = new Headers(response.headers);
          newHeaders.set("Content-Type", "text/html; charset=utf-8");
          newHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
          newHeaders.set("X-Diagnostic-Step", diag.step);

          return new Response(body, {
            status: response.status,
            headers: newHeaders
          });
        }

        return response;
      }

      // 5. Fallback for other requests
      diag.step = 'static-fallback';
      return env.ASSETS.fetch(request);

    } catch (e) {
      workerLog(`FATAL ERROR: ${e.message}`);
      return new Response(`Worker Fatal Error (${VERSION}): ${e.message}`, { status: 500 });
    }
  }
};
