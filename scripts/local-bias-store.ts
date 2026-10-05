import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile, link, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import type { Plugin } from "vite";

export function createLocalBiasStore(directory: string) {
  const file = (key: string) => resolve(directory, createHash("sha256").update(key).digest("hex"));
  return {
    async get(key: string) {
      let raw: string;
      try { raw = await readFile(file(key), "utf8"); }
      catch (error: any) { if (error.code === "ENOENT") return null; throw error; }
      const saved = JSON.parse(raw);
      const bytes = Buffer.from(saved.bytes, "base64");
      return { bytes, contentType: saved.contentType, json: async () => JSON.parse(bytes.toString("utf8")) };
    },
    async head(key: string) { return this.get(key); },
    async put(key: string, bytes: Uint8Array | string, options: any = {}) {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const target = file(key);
      const temp = `${target}.${crypto.randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify({ bytes: Buffer.from(bytes).toString("base64"), contentType: options.httpMetadata?.contentType || "application/octet-stream" }), { mode: 0o600 });
      try {
        // Linking a complete temp file makes publication atomic and immutable.
        await link(temp, target);
      } catch (error: any) { if (error.code === "EEXIST") return null; throw error; }
      finally { await unlink(temp); }
      return { key };
    },
  };
}

export function localBiasStorePlugin(secret: string): Plugin {
  const store = createLocalBiasStore(resolve(process.cwd(), ".local-bias-store"));
  return {
    name: "local-bias-store", apply: "serve",
    configureServer(server) {
      (globalThis as any).LOCAL_BIAS_STORE = store;
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");
        if (!url.pathname.startsWith("/local-bias-chart/")) return next();
        try {
          const key = decodeURIComponent(url.pathname.slice("/local-bias-chart/".length));
          const expected = createHmac("sha256", secret).update(key).digest();
          const actual = Buffer.from(url.searchParams.get("signature") || "", "hex");
          if (req.method !== "GET" || !secret || !/^[a-f0-9-]{36}\/bias-submissions\//.test(key) || actual.length !== expected.length || !timingSafeEqual(expected, actual)) {
            res.statusCode = 403; res.end(); return;
          }
          const object = await store.get(key);
          if (!object) { res.statusCode = 404; res.end(); return; }
          res.setHeader("Content-Type", object.contentType);
          res.setHeader("Cache-Control", "no-store");
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.end(object.bytes);
        } catch { res.statusCode = 500; res.end(); }
      });
    },
  };
}
