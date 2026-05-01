import { createServerFn } from "@tanstack/react-start";
import { getWebRequest } from "@tanstack/react-start/server";

/**
 * Server function to upload a file to Cloudflare R2.
 */
export const uploadToR2 = createServerFn({ method: "POST" })
  .validator((d: { path: string; base64: string; contentType: string }) => d)
  .handler(async ({ data }) => {
    const request = getWebRequest();
    // @ts-ignore
    const env = request?.context?.cloudflare?.env || request?.context || (globalThis as any);
    const r2 = env?.R2;
    
    if (!r2) {
      console.error("R2 binding 'R2' not found in context:", Object.keys(env || {}));
      throw new Error("R2 binding 'R2' not found.");
    }

    // Convert base64 to Uint8Array for R2 storage
    const binaryString = atob(data.base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    await r2.put(data.path, bytes, {
      httpMetadata: { contentType: data.contentType },
    });

    return { success: true };
  });

/**
 * Server function to delete a file from Cloudflare R2.
 */
export const deleteFromR2 = createServerFn({ method: "POST" })
  .validator((path: string) => path)
  .handler(async ({ data: path }) => {
    const request = getWebRequest();
    // @ts-ignore
    const env = request?.context?.cloudflare?.env || request?.context || (globalThis as any);
    const r2 = env?.R2;
    
    if (!r2) {
      throw new Error("R2 binding 'R2' not found.");
    }

    await r2.delete(path);
    return { success: true };
  });

/**
 * Server function to fetch a file from Cloudflare R2.
 * This is used by the proxy route to serve images.
 */
export const fetchFromR2 = createServerFn({ method: "GET" })
  .validator((path: string) => path)
  .handler(async ({ data: path }) => {
    const request = getWebRequest();
    // @ts-ignore
    const env = request?.context?.cloudflare?.env || request?.context || (globalThis as any);
    const r2 = env?.R2;
    
    if (!r2) {
      console.error("R2 binding 'R2' not found in fetch handler");
      return new Response("Storage configuration error (R2 not found)", { status: 500 });
    }

    const object = await r2.get(path);

    if (!object) {
      return new Response("Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    headers.set("Cache-Control", "public, max-age=31536000, immutable");

    return new Response(object.body, {
      headers,
    });
  });
