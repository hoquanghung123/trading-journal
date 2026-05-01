import { createServerFn } from "@tanstack/react-start";
import { getEvent } from "vinxi/http";

/**
 * Server function to upload a file to Cloudflare R2.
 * This function runs only on the server and uses the R2 binding.
 */
export const uploadToR2 = createServerFn({ method: "POST" })
  .validator((d: { path: string; base64: string; contentType: string }) => d)
  .handler(async ({ data }) => {
    const event = getEvent();
    if (!event) {
      throw new Error("No event context found. This function must run on the server.");
    }

    // @ts-ignore - Cloudflare context is added by the adapter
    const r2 = event.context.cloudflare?.env?.R2;
    if (!r2) {
      throw new Error("R2 binding 'R2' not found in Cloudflare environment.");
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
    const event = getEvent();
    if (!event) {
      throw new Error("No event context found.");
    }

    // @ts-ignore
    const r2 = event.context.cloudflare?.env?.R2;
    if (!r2) {
      throw new Error("R2 binding 'R2' not found.");
    }

    await r2.delete(path);
    return { success: true };
  });
