import { createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  head: (ctx) => {
    const isTg = ctx.matches.some(m => m.pathname.startsWith('/tg'));
    return {
      links: [{ rel: "stylesheet", href: isTg ? "tg.css" : "app.css" }]
    };
  }
});
