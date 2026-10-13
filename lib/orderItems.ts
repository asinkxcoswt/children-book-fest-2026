import type { OrderItemInput, TicketConfig } from "@/lib/ticketApi";

/** One ticket the buyer is purchasing, as posted by the browser: a ticket type
 *  plus the add-on quantities chosen for THIS ticket. Buying three tickets
 *  posts three boxes. Untrusted until `resolveBoxes` has checked it. */
export interface TicketBox {
  code: string;
  /** Absolute quantity per add-on code; missing codes mean "included". */
  addOns?: Record<string, number>;
}

/** Narrows whatever JSON the browser sent to well-formed boxes. Shape only —
 *  codes and quantities are checked against the platform in `resolveBoxes`. */
export function parseBoxes(raw: unknown): TicketBox[] {
  if (!Array.isArray(raw)) return [];
  const boxes: TicketBox[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const { code, addOns } = b as { code?: unknown; addOns?: unknown };
    if (typeof code !== "string" || !code) continue;
    const clean: Record<string, number> = {};
    if (addOns && typeof addOns === "object") {
      for (const [k, v] of Object.entries(addOns as Record<string, unknown>)) {
        if (Number.isInteger(v) && (v as number) >= 0) clean[k] = v as number;
      }
    }
    boxes.push({ code, addOns: clean });
  }
  return boxes;
}

/** Validates boxes against a fresh read of the ticket options and folds them
 *  into platform order items. Identical boxes (same type, same add-on
 *  quantities) become one item with a quantity — an item describes N identical
 *  tickets — so an event with no add-ons posts exactly what it did before.
 *
 *  Rejected: unknown ticket or add-on code, an add-on quantity outside
 *  [included, max], or more boxes of one type than its per-order limit. Stock
 *  is deliberately NOT checked here — the platform reserves atomically and its
 *  sold-out message is the one the buyer should see. */
export function resolveBoxes(
  boxes: TicketBox[],
  configs: TicketConfig[],
): { items: OrderItemInput[] } | { error: string } {
  if (boxes.length === 0) return { error: "no tickets selected" };
  const byCode = new Map(configs.map((c) => [c.code, c]));
  const grouped = new Map<string, OrderItemInput>();
  const perType = new Map<string, number>();

  for (const box of boxes) {
    const cfg = byCode.get(box.code);
    if (!cfg) return { error: `unknown ticket: ${box.code}` };

    const n = (perType.get(cfg.code) ?? 0) + 1;
    if (n > cfg.limitPerOrder) return { error: `limit per order exceeded: ${cfg.code}` };
    perType.set(cfg.code, n);

    const defs = cfg.addOns ?? [];
    const chosen = box.addOns ?? {};
    for (const k of Object.keys(chosen)) {
      if (!defs.some((d) => d.code === k)) return { error: `unknown add-on: ${k}` };
    }
    const addOns = defs.map((d) => {
      const qty = chosen[d.code] ?? d.included;
      return { code: d.code, qty };
    });
    for (const a of addOns) {
      const d = defs.find((x) => x.code === a.code)!;
      if (a.qty < d.included || a.qty > d.max) return { error: `add-on out of range: ${a.code}` };
    }

    const key = `${cfg.code}|${addOns.map((a) => `${a.code}=${a.qty}`).join(",")}`;
    const existing = grouped.get(key);
    if (existing) existing.quantity += 1;
    else {
      grouped.set(key, {
        code: cfg.code,
        quantity: 1,
        ...(addOns.length ? { addOns } : {}),
      });
    }
  }
  return { items: [...grouped.values()] };
}
