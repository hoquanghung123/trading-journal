import { createFileRoute } from "@tanstack/react-router";
import { getEvent } from "vinxi/http";

/**
 * Splat route to serve images from Cloudflare R2.
 * URL format: /storage/user_id/image_id.png
 */
export const Route = createFileRoute("/storage/$")({
  loader: async ({ params }) => {
    const path = params["*"]; // Access the splat part of the route
    const event = getEvent();

    if (!event) {
      return new Response("Server context not available", { status: 500 });
    }

    // @ts-ignore
    const r2 = event.context.cloudflare?.env?.R2;
    if (!r2) {
      console.error("R2 binding not found");
      return new Response("Storage not configured", { status: 500 });
    }

    try {
      const object = await r2.get(path);

      if (!object) {
        return new Response("Image not found", { status: 404 });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      // Cache for 1 year as images are immutable
      headers.set("Cache-Control", "public, max-age=31536000, immutable");

      return new Response(object.body, {
        headers,
      });
    } catch (err) {
      console.error("Error fetching from R2:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});
