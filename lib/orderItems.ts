import type { OrderItemInput, OrderItemUnit, PurchaseFormField, TicketConfig } from "@/lib/ticketApi";

/** One ticket the buyer is purchasing, as posted by the browser: a ticket type,
 *  the add-on quantities chosen for THIS ticket, and any per-unit answers
 *  (child names). Buying three tickets posts three boxes. Untrusted until
 *  `resolveBoxes` has checked it. */
export interface TicketBox {
  code: string;
  /** Absolute quantity per add-on code; missing codes mean "included". */
  addOns?: Record<string, number>;
  /** Add-on code → one answer record per unit, keyed by field key. */
  units?: Record<string, Record<string, string>[]>;
}

/** Narrows whatever JSON the browser sent to well-formed boxes. Shape only —
 *  codes, quantities and answers are checked against the platform in
 *  `resolveBoxes`. */
export function parseBoxes(raw: unknown): TicketBox[] {
  if (!Array.isArray(raw)) return [];
  const boxes: TicketBox[] = [];
  for (const b of raw) {
    if (!b || typeof b !== "object") continue;
    const { code, addOns, units } = b as { code?: unknown; addOns?: unknown; units?: unknown };
    if (typeof code !== "string" || !code) continue;
    const cleanAddOns: Record<string, number> = {};
    if (addOns && typeof addOns === "object") {
      for (const [k, v] of Object.entries(addOns as Record<string, unknown>)) {
        if (Number.isInteger(v) && (v as number) >= 0) cleanAddOns[k] = v as number;
      }
    }
    const cleanUnits: Record<string, Record<string, string>[]> = {};
    if (units && typeof units === "object") {
      for (const [k, list] of Object.entries(units as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        cleanUnits[k] = list.map((rec) => {
          const out: Record<string, string> = {};
          if (rec && typeof rec === "object") {
            for (const [fk, fv] of Object.entries(rec as Record<string, unknown>)) {
              if (typeof fv === "string") out[fk] = fv.trim();
            }
          }
          return out;
        });
      }
    }
    boxes.push({ code, addOns: cleanAddOns, units: cleanUnits });
  }
  return boxes;
}

/** Validates one unit's answers against the add-on's own field list. Blank
 *  optional answers are dropped rather than sent as "". */
function checkUnit(
  fields: PurchaseFormField[],
  given: Record<string, string> | undefined,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const value = given?.[f.key] ?? "";
    if (!value) {
      if (f.required) return null;
      continue;
    }
    if (f.type === "select" && f.options?.length && !f.options.includes(value)) return null;
    out[f.key] = value;
  }
  return out;
}

/** Validates boxes against a fresh read of the ticket options and folds them
 *  into platform order items. Identical boxes (same type, same add-on
 *  quantities) become one item with a quantity — an item describes N identical
 *  tickets — with each box's per-unit answers appended in order.
 *
 *  Rejected: unknown ticket or add-on code, an add-on quantity outside
 *  [included, max], more boxes of one type than its per-order limit, more
 *  seats than a seat-counted option has left, or (when `collectUnits`) a
 *  missing required per-unit answer. Ticket-counted stock is deliberately NOT
 *  checked here — the platform reserves atomically and its sold-out message is
 *  the one the buyer should see.
 *
 *  `collectUnits` is false on the chat path: the LINE form asks those
 *  questions itself, and the contract says never to send them. */
/** What `resolveBoxes` needs to know about a ticket type — satisfied by the
 *  platform's TicketConfig and by the trimmed TicketOption the browser holds. */
export type ResolvableConfig = Pick<
  TicketConfig,
  "code" | "limitPerOrder" | "available" | "capacityUnit" | "addOns"
>;

export function resolveBoxes(
  boxes: TicketBox[],
  configs: ResolvableConfig[],
  { collectUnits }: { collectUnits: boolean },
): { items: OrderItemInput[] } | { error: string } {
  if (boxes.length === 0) return { error: "no tickets selected" };
  const byCode = new Map(configs.map((c) => [c.code, c]));
  const grouped = new Map<string, OrderItemInput>();
  const perType = new Map<string, number>();
  const seatsPerType = new Map<string, number>();

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
    const addOns = defs.map((d) => ({ code: d.code, qty: chosen[d.code] ?? d.included }));
    for (const a of addOns) {
      const d = defs.find((x) => x.code === a.code)!;
      if (a.qty < d.included || a.qty > d.max) return { error: `add-on out of range: ${a.code}` };
    }

    if (cfg.capacityUnit === "seats") {
      const seats = addOns.reduce(
        (sum, a) => sum + (defs.find((d) => d.code === a.code)?.countsAsSeat ? a.qty : 0),
        0,
      );
      const used = (seatsPerType.get(cfg.code) ?? 0) + seats;
      if (used > cfg.available) return { error: "not enough seats" };
      seatsPerType.set(cfg.code, used);
    }

    let unit: OrderItemUnit | undefined;
    if (collectUnits) {
      const answers: OrderItemUnit["addOns"] = {};
      for (const d of defs) {
        if (!d.fields?.length) continue;
        const qty = addOns.find((a) => a.code === d.code)!.qty;
        const given = box.units?.[d.code] ?? [];
        const records: Record<string, string>[] = [];
        for (let i = 0; i < qty; i++) {
          const rec = checkUnit(d.fields, given[i]);
          if (!rec) return { error: `missing answer: ${d.code}[${i}]` };
          records.push(rec);
        }
        answers[d.code] = records;
      }
      if (Object.keys(answers).length) unit = { addOns: answers };
    }

    const key = `${cfg.code}|${addOns.map((a) => `${a.code}=${a.qty}`).join(",")}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.quantity += 1;
      if (unit) existing.units!.push(unit);
    } else {
      grouped.set(key, {
        code: cfg.code,
        quantity: 1,
        ...(addOns.length ? { addOns } : {}),
        ...(unit ? { units: [unit] } : {}),
      });
    }
  }
  return { items: [...grouped.values()] };
}
