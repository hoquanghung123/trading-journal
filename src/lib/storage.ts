import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

/**
 * Server function to upload a file to Cloudflare R2.
 */
export const uploadToR2 = createServerFn({ method: "POST" })
  .handler(async ({ data }: { data: { path: string; base64: string; contentType: string } }) => {
    const request = getRequest();
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
 * Server function to fetch a remote image and return it as base64.
 * Used to bypass CORS for TradingView snapshots.
 */
export const proxyFetchImage = createServerFn({ method: "POST" })
  .handler(async ({ data: url }: { data: string }) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch remote image: ${response.statusText}`);
    
    const contentType = response.headers.get("content-type") || "image/png";
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Convert to base64
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    
    return {
      base64,
      contentType,
    };
  });

/**
 * Server function to delete a file from Cloudflare R2.
 */
export const deleteFromR2 = createServerFn({ method: "POST" })
  .handler(async ({ data: path }: { data: string }) => {
    const request = getRequest();
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
  .handler(async ({ data: path }: { data: string }) => {
    const request = getRequest();
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
