import { createServerFn } from "@tanstack/react-start";

/**
 * Server function to upload a file to Cloudflare R2.
 */
export const uploadToR2 = createServerFn({ method: "POST" })
  .validator((d: { path: string; base64: string; contentType: string }) => d)
  .handler(async ({ data }) => {
    // In Cloudflare Pages, bindings are typically available on process.env in these environments
    // @ts-ignore
    const r2 = process.env.R2 || (globalThis as any).R2;
    if (!r2) {
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
    // @ts-ignore
    const r2 = process.env.R2 || (globalThis as any).R2;
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
    // @ts-ignore
    const r2 = process.env.R2 || (globalThis as any).R2;
    if (!r2) {
      return new Response("Storage configuration error", { status: 500 });
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
