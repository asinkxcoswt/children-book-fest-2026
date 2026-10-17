/* The Cloudflare Worker that fronts the site: /api/* goes to the ticket
 * proxies in functions/api, everything else is the static export in out/
 * served from the assets binding. Deployed with `wrangler deploy`; the
 * handlers keep their Pages-Functions shape so they stay plain functions
 * that take {request, env}. */

import type { Ctx, Env } from "../functions/_lib";
import { fail } from "../functions/_lib";
import { onRequestGet as tickets } from "../functions/api/tickets";
import { onRequestPost as orders } from "../functions/api/orders";
import { onRequestPost as intent } from "../functions/api/orders/intent";

interface WorkerEnv extends Env {
  /** Static assets binding (wrangler.jsonc → assets.binding). */
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

type Handler = (ctx: Ctx) => Promise<Response>;

const routes: Record<string, Partial<Record<"GET" | "POST", Handler>>> = {
  "/api/tickets": { GET: tickets },
  "/api/orders": { POST: orders },
  "/api/orders/intent": { POST: intent },
};

const worker = {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname.startsWith("/api/")) {
      const route = routes[pathname.replace(/\/$/, "")];
      if (!route) return fail("not found", 404);
      const handler = route[request.method as "GET" | "POST"];
      if (!handler) return fail("method not allowed", 405);
      return handler({ request, env });
    }
    return env.ASSETS.fetch(request);
  },
};

export default worker;
