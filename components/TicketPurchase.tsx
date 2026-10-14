"use client";

import { useEffect, useRef, useState } from "react";
import type { ColorToken } from "@/types/content";
import { tokenClasses, tokenHex, cssVar } from "@/lib/colors";
import { t, formatDate, formatTimeRange } from "@/lib/i18n";
import type { PaymentMethod, PurchaseFormField, TicketAddOn } from "@/lib/ticketApi";
import type { TicketBox as TicketBoxPayload } from "@/lib/orderItems";
import AttendeeFormModal, {
  type PurchaseAnswers,
  type UnitAnswers,
  type UnitGroup,
} from "@/components/AttendeeFormModal";
import LineQrPanel from "@/components/LineQrPanel";

interface TicketOption {
  code: string;
  /** The round number ("รอบที่ 1"); the day and time come from the session. */
  name: string;
  /** Organizer's section label for anything that is NOT time — zone, tier,
   *  package. null = ungrouped. */
  group: string | null;
  /** Satang; 0 = free. */
  price: number;
  limitPerOrder: number;
  /** What one ticket takes out of this depends on `capacityUnit`. */
  available: number;
  /** "tickets": one unit per ticket. "seats": a ticket takes the sum of its
   *  seat-counting add-ons' quantities — a family of four needs four. */
  capacityUnit: "tickets" | "seats";
  /** Calendar day the ticket admits on (YYYY-MM-DD, resolved by the platform
   *  in Asia/Bangkok), or null for an event with no sessions. */
  sessionDate: string | null;
  sessionStartAt: string | null;
  sessionEndAt: string | null;
  /** Per-ticket composition dimensions (adult, child, kit…). Empty = a plain
   *  ticket with nothing to configure. */
  addOns: TicketAddOn[];
}

interface RefundPolicy {
  allowed: boolean;
  termEn: string;
  termTh: string;
}

/** One ticket the buyer is assembling. `code` is null until a session is
 *  chosen; `addOns` holds absolute quantities keyed by add-on code. */
interface Box {
  id: number;
  code: string | null;
  addOns: Record<string, number>;
}

function baht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

/** Every add-on starts at what the ticket includes. */
function defaultAddOns(tk: TicketOption | undefined): Record<string, number> {
  return Object.fromEntries((tk?.addOns ?? []).map((a) => [a.code, a.included]));
}

/** Ticket price plus every add-on unit above what is included. */
function boxPrice(tk: TicketOption, box: Box): number {
  return tk.addOns.reduce(
    (sum, a) => sum + Math.max(0, (box.addOns[a.code] ?? a.included) - a.included) * a.extraPrice,
    tk.price,
  );
}

/** Seats one ticket takes out of a seat-counted option's stock. For a
 *  ticket-counted option every ticket is one unit regardless of add-ons. */
function seatsOf(tk: TicketOption, addOns: Record<string, number>): number {
  if (tk.capacityUnit !== "seats") return 1;
  return tk.addOns.reduce(
    (sum, a) => sum + (a.countsAsSeat ? (addOns[a.code] ?? a.included) : 0),
    0,
  );
}

/** Sold out means "cannot fit one more ticket at its included composition",
 *  not "available is zero": a family ticket needing two seats is gone when
 *  one seat is left. */
function soldOut(tk: TicketOption): boolean {
  return tk.available < seatsOf(tk, defaultAddOns(tk));
}

/** One line per ticket for assistive tech and for the dropdown: day, time,
 *  round, price. "รอบที่ 1" alone gives no way to tell which day it is. */
function describe(tk: TicketOption): string {
  const time = tk.sessionStartAt ? formatTimeRange(tk.sessionStartAt, tk.sessionEndAt) : "";
  return [tk.sessionDate && formatDate(tk.sessionDate), time, tk.name, tk.group]
    .filter(Boolean)
    .join(" · ");
}

/** In-app ticket purchase. Each card is ONE ticket being bought: the buyer
 *  picks its session, adjusts its add-ons (extra children, kits…) and adds
 *  another card for another ticket. Attendee details come in a confirmation
 *  modal; the order is created through our own API routes and paid on Stripe
 *  Checkout or in LINE. Shows an unavailable notice if the ticket service is
 *  unreachable. */
export default function TicketPurchase({ slug, color }: { slug: string; color: ColorToken }) {
  const c = tokenClasses(color);

  const [tickets, setTickets] = useState<TicketOption[] | null>(null);
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicy | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormField[]>([]);
  const [failed, setFailed] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([{ id: 1, code: null, addOns: {} }]);
  const [nextId, setNextId] = useState(2);
  /** Why a stepper tap did nothing, shown under that row for a moment. The
   *  buttons at a bound stay tappable so the answer arrives where the buyer is
   *  looking, instead of a greyed button they have to puzzle over. */
  const [notice, setNotice] = useState<{ boxId: number; code: string; text: string } | null>(null);
  const noticeTimer = useRef<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Chat-checkout link for the current selection. Kept keyed by `sig` so a
   *  stale link can never be followed after the buyer changes the basket. */
  const [intent, setIntent] = useState<{ sig: string; lineUrl: string } | null>(null);
  const [startingLine, setStartingLine] = useState(false);
  /** Set when the deep link was fired but this page never went away. */
  const [handoffFailed, setHandoffFailed] = useState(false);
  /** A LINE deep link needs the app on the same device, so desktop gets a QR
   *  instead. Detected from the pointer rather than the user agent, and only
   *  after mount — false on the server keeps the mobile path flash-free. */
  const [desktop, setDesktop] = useState(false);
  /** Brand colours for CowTicket's hosted ticket page, read from our own
   *  stylesheet so globals.css stays the only place these hexes are written.
   *  Read at click time, not during render: it touches the DOM. */
  const readTheme = () => ({
    primaryColor: tokenHex(color),
    secondaryColor: cssVar("--color-ink"),
  });

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tickets?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then(
        (data: {
          tickets: TicketOption[];
          refundPolicy: RefundPolicy | null;
          paymentMethods: PaymentMethod[];
          purchaseForm: PurchaseFormField[];
        }) => {
          if (!alive) return;
          const list = data.tickets;
          setTickets(list);
          setRefundPolicy(data.refundPolicy);
          setPaymentMethods(data.paymentMethods ?? []);
          setPurchaseForm(data.purchaseForm ?? []);
          // The first ticket starts on the first session still on sale, so the
          // card reads as a ticket from the outset; the session is changeable
          // from its header.
          const first = list.find((tk) => !soldOut(tk));
          if (first) setBoxes([{ id: 1, code: first.code, addOns: defaultAddOns(first) }]);
        },
      )
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const byCode = new Map((tickets ?? []).map((tk) => [tk.code, tk]));
  const optionOf = (box: Box) => (box.code ? byCode.get(box.code) : undefined);

  /** How many OTHER cards already sit on this session. */
  const othersOn = (code: string, exceptId: number) =>
    boxes.filter((b) => b.code === code && b.id !== exceptId).length;
  /** Stock the OTHER cards on this session already take, in its own unit. */
  const stockUsedBy = (tk: TicketOption, exceptId: number) =>
    boxes
      .filter((b) => b.code === tk.code && b.id !== exceptId)
      .reduce((sum, b) => sum + seatsOf(tk, b.addOns), 0);
  /** Whether a card can sit on this session: under the per-order limit, and
   *  with room for a fresh ticket at its included composition. */
  const canPick = (tk: TicketOption, box: Box) =>
    othersOn(tk.code, box.id) < tk.limitPerOrder &&
    stockUsedBy(tk, box.id) + seatsOf(tk, defaultAddOns(tk)) <= tk.available;
  /** Another card is only offered while some session can still take one. */
  const canAdd = (tickets ?? []).some((tk) => canPick(tk, { id: -1, code: null, addOns: {} }));

  const chosen = boxes.filter((b) => b.code !== null);
  const total = chosen.reduce((sum, b) => {
    const tk = optionOf(b);
    return tk ? sum + boxPrice(tk, b) : sum;
  }, 0);
  /** Every card has a session — the only state the checkout buttons accept. */
  const complete = boxes.length > 0 && chosen.length === boxes.length;

  const chatCheckout = paymentMethods.includes("PROMPTPAY");
  const cardCheckout = paymentMethods.includes("STRIPE");

  const payload: TicketBoxPayload[] = chosen.map((b) => ({ code: b.code!, addOns: b.addOns }));
  const sig = JSON.stringify(payload);

  /** Per-unit questions for the card path: one group per unit of every add-on
   *  that asks something, in basket order, headed "บัตรใบที่ 1 · เด็ก 2". */
  const unitGroups: UnitGroup[] = boxes.flatMap((box, index) => {
    const tk = optionOf(box);
    if (!tk) return [];
    return tk.addOns.flatMap((a) => {
      if (!a.fields?.length) return [];
      const qty = box.addOns[a.code] ?? a.included;
      return Array.from({ length: qty }, (_, i) => ({
        id: `${box.id}:${a.code}:${i}`,
        heading: `${t("ticketNo")} ${index + 1} · ${a.name} ${qty > 1 ? i + 1 : ""}`.trim(),
        fields: a.fields!,
      }));
    });
  });

  function pickSession(id: number, code: string) {
    setBoxes((bs) =>
      bs.map((b) =>
        // A new session means a new set of add-ons; start them at included.
        b.id === id && b.code !== code ? { ...b, code, addOns: defaultAddOns(byCode.get(code)) } : b,
      ),
    );
  }

  function showNotice(boxId: number, code: string, text: string) {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice({ boxId, code, text });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3000);
  }

  function stepAddOn(id: number, addOn: TicketAddOn, delta: number) {
    const box = boxes.find((b) => b.id === id);
    if (!box) return;
    const cur = box.addOns[addOn.code] ?? addOn.included;
    const next = cur + delta;
    if (next < addOn.included) {
      return showNotice(id, addOn.code, t("addOnIncluded").replace("{n}", String(addOn.included)));
    }
    if (next > addOn.max) {
      return showNotice(id, addOn.code, t("addOnLimit").replace("{n}", String(addOn.max)));
    }
    // A seat-counted option can run out mid-ticket: the fourth child needs a
    // fifth seat that may not be there.
    const tk = optionOf(box);
    if (tk && addOn.countsAsSeat && tk.capacityUnit === "seats" && delta > 0) {
      const wanted = stockUsedBy(tk, id) + seatsOf(tk, { ...box.addOns, [addOn.code]: next });
      if (wanted > tk.available) return showNotice(id, addOn.code, t("notEnoughSeats"));
    }
    setNotice(null);
    setBoxes((bs) =>
      bs.map((b) => (b.id === id ? { ...b, addOns: { ...b.addOns, [addOn.code]: next } } : b)),
    );
  }

  function addBox() {
    // Deliberately unchosen: a new card that already names a session is one
    // the buyer may not notice they need to check. The checkout buttons stay
    // disabled until it has one.
    setBoxes((bs) => [...bs, { id: nextId, code: null, addOns: {} }]);
    setNextId((n) => n + 1);
  }

  function removeBox(id: number) {
    setBoxes((bs) => (bs.length > 1 ? bs.filter((b) => b.id !== id) : bs));
  }

  /** Creates the chat purchase, on click only. An intent is a real record on the
   *  platform, so one is made per deliberate purchase attempt — never per
   *  stepper tweak. Cached against the current selection so clicking again
   *  without changing the basket reuses it. */
  async function startLineCheckout() {
    if (startingLine) return;
    if (intent?.sig === sig) return handoff(intent.lineUrl);
    setStartingLine(true);
    setHandoffFailed(false);
    try {
      const res = await fetch("/api/orders/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, boxes: payload, theme: readTheme() }),
      });
      const data = (await res.json()) as { lineUrl?: string };
      if (res.ok && data.lineUrl) {
        setIntent({ sig, lineUrl: data.lineUrl });
        handoff(data.lineUrl);
        return;
      }
    } catch {
      // fall through to the idle state; the buyer can try again
    }
    setStartingLine(false);
  }

  /** Desktop scans a code; everywhere else we navigate to the deep link. If
   *  this page is still in front shortly afterwards the webview swallowed the
   *  navigation, and we offer a plain anchor for the buyer to press. */
  function handoff(lineUrl: string) {
    if (desktop) {
      setStartingLine(false);
      return; // the QR panel renders from `intent`
    }
    window.location.assign(lineUrl);
    window.setTimeout(() => {
      if (document.visibilityState === "visible") {
        setStartingLine(false);
        setHandoffFailed(true);
      }
    }, 1200);
  }

  async function confirmOrder(answers: PurchaseAnswers, units: UnitAnswers): Promise<string | null> {
    setSubmitting(true);
    try {
      // Fold the dialog's flat unit answers back onto their boxes: add-on code
      // → one record per unit, in order.
      const withUnits: TicketBoxPayload[] = chosen.map((b) => {
        const tk = optionOf(b)!;
        const perAddOn: NonNullable<TicketBoxPayload["units"]> = {};
        for (const a of tk.addOns) {
          if (!a.fields?.length) continue;
          const qty = b.addOns[a.code] ?? a.included;
          perAddOn[a.code] = Array.from({ length: qty }, (_, i) => units[`${b.id}:${a.code}:${i}`] ?? {});
        }
        return { code: b.code!, addOns: b.addOns, units: perAddOn };
      });
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, answers, boxes: withUnits, theme: readTheme() }),
      });
      const data = (await res.json()) as {
        checkoutUrl?: string | null;
        error?: string;
        ticketUrl?: string;
      };
      if (!res.ok) {
        setSubmitting(false);
        return data.error ?? t("ticketsUnavailable");
      }
      // Both destinations are off-site — Stripe, or CowTicket's ticket page for a
      // free order that skips it. Neither is a route of ours, so never router.push.
      const next = data.checkoutUrl || data.ticketUrl;
      if (!next) {
        setSubmitting(false);
        return t("ticketsUnavailable");
      }
      window.location.assign(next);
      return null; // navigating away; keep the modal in its busy state
    } catch {
      setSubmitting(false);
      return t("ticketsUnavailable");
    }
  }

  if (failed) {
    // Ticket service unreachable — nothing to link to, so just say so.
    return <p className="text-sm text-ink/60">{t("ticketsUnavailable")}</p>;
  }

  if (!tickets) {
    // Skeleton mirroring a ticket card so the sidebar doesn't jump.
    return (
      <div role="status" aria-label={t("loadingTickets")}>
        <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>
        <ul className="mt-3 space-y-3" aria-hidden>
          <li
            className={`relative animate-pulse overflow-hidden rounded-2xl border-y-2 border-r-2 border-l-8 border-y-ink/10 border-r-ink/10 pl-2 ${c.edge} opacity-40`}
          >
            <div className="flex items-center justify-between gap-2 p-3 pb-2">
              <span className="h-4 w-24 rounded-full bg-ink/10" />
              <span className={`h-6 w-14 rounded-full ${c.soft}`} />
            </div>
            <div className="mx-3 border-t-2 border-dashed border-ink/10" />
            <div className="space-y-2 p-3 pt-2">
              <span className="block h-10 rounded-xl bg-ink/5" />
              <span className="block h-10 rounded-xl bg-ink/5" />
            </div>
          </li>
        </ul>
        <p className="mt-3 flex items-center gap-2 text-sm text-ink/60">
          <span aria-hidden className="relative flex h-2.5 w-2.5">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${c.bg} opacity-60`} />
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${c.bg}`} />
          </span>
          {t("loadingTickets")}
        </p>
      </div>
    );
  }

  if (tickets.length === 0) {
    // Empty ticketConfigs is a state, not a failure: outside the selling window,
    // or the organizer archived the event. Never render this as an error.
    return (
      <div>
        <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>
        <p className="mt-3 text-sm text-ink/60">{t("notOnSale")}</p>
      </div>
    );
  }

  /** With one session there is nothing to change, so no hint and no picker. */
  const switchable = tickets.length > 1;
  const stepBtn =
    "flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-lg transition-colors disabled:opacity-30";

  return (
    <div>
      <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>

      <ul className="mt-3 space-y-3">
        {boxes.map((box, index) => {
          const tk = optionOf(box);
          const label = `${t("ticketNo")} ${index + 1}`;
          const time = tk?.sessionStartAt ? formatTimeRange(tk.sessionStartAt, tk.sessionEndAt) : "";
          // Ticket-stub spine drawn as the left border so the colour reaches the
          // card edge and follows the radius; sides addressed individually so no
          // shorthand competes with the left edge.
          return (
            <li
              key={box.id}
              className={`relative overflow-hidden rounded-2xl border-y-2 border-r-2 border-l-8 border-y-ink/10 border-r-ink/10 ${c.edge} pl-2 ${c.soft}`}
            >
              {/* The ticket face: date, time, round, price — the same card as
                  before. The session text is also the picker: a native select
                  sits invisibly over it, so a tap opens the platform's own
                  chooser, and the hint underneath says so. */}
              <div className="flex items-start justify-between gap-2 p-3 pb-2">
                <div className="relative min-w-0 flex-1 rounded-lg focus-within:ring-2 focus-within:ring-ink focus-within:ring-offset-2">
                  {tk ? (
                    <>
                      <p className={`font-display text-xs ${c.text}`}>
                        {boxes.length > 1 && <span className="text-ink/50">{label} · </span>}
                        {tk.sessionDate && formatDate(tk.sessionDate)}
                      </p>
                      <p className="font-display text-base text-ink">
                        {time || tk.name}
                        {switchable && <span aria-hidden className="ml-1 text-ink/40">▾</span>}
                      </p>
                      {time && <p className="text-xs text-ink/60">{[tk.group, tk.name].filter(Boolean).join(" · ")}</p>}
                      {switchable && <p className={`mt-0.5 text-xs ${c.text}`}>{t("tapToChangeSession")}</p>}
                    </>
                  ) : tickets.every(soldOut) ? (
                    // Nothing on sale fits even one more ticket: say so rather
                    // than offer a picker with every round greyed out.
                    <p className="font-display text-base text-tomato">{t("eventFull")}</p>
                  ) : (
                    <>
                      <p className={`font-display text-xs ${c.text}`}>{label}</p>
                      <p className="font-display text-base text-ink">
                        {t("chooseSession")}
                        <span aria-hidden className="ml-1 text-ink/40">▾</span>
                      </p>
                    </>
                  )}
                  {(switchable || !tk) && !tickets.every(soldOut) && (
                    <select
                      value={box.code ?? ""}
                      onChange={(e) => e.target.value && pickSession(box.id, e.target.value)}
                      aria-label={`${t("chooseSession")} — ${label}`}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    >
                      <option value="" disabled>
                        {t("chooseSession")}
                      </option>
                      {tickets.map((opt) => {
                        const enabled = box.code === opt.code || canPick(opt, box);
                        const price = opt.price === 0 ? t("free") : baht(opt.price);
                        const note =
                          soldOut(opt)
                            ? t("soldOut")
                            : !enabled
                              ? t("limitReached")
                              : opt.available <= 10
                                ? `${opt.available} ${t("ticketsLeft")}`
                                : "";
                        return (
                          <option key={opt.code} value={opt.code} disabled={!enabled}>
                            {[describe(opt), price, note].filter(Boolean).join(" · ")}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
                {/* Stacked, not side by side: a row of ✕ + pill squeezed the
                    date line into two lines. */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {boxes.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeBox(box.id)}
                      aria-label={`${t("removeTicket")} — ${label}`}
                      className="-mr-1 -mt-1 flex h-7 w-7 items-center justify-center rounded-full text-ink/50 transition-colors hover:bg-ink/10 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
                    >
                      <span aria-hidden>✕</span>
                    </button>
                  )}
                  {tk && (
                    <span className={`rounded-full px-3 py-0.5 font-display text-sm ${c.bg} ${c.on}`}>
                      {boxPrice(tk, box) === 0 ? t("free") : baht(boxPrice(tk, box))}
                    </span>
                  )}
                </div>
              </div>

              {/* Below the perforation: what this one ticket is made of. A
                  plain ticket only warns when stock is low; the per-order
                  limit is not announced — the buyer meets it when the picker
                  greys a round out. No perforation when nothing sits under it. */}
              {tk && tk.addOns.length === 0 && tk.available <= 10 && (
                <>
                  <div className="mx-3 border-t-2 border-dashed border-ink/10" />
                  <p className="p-3 pt-2 text-right text-xs text-ink/50">
                    {tk.available} {t("ticketsLeft")}
                  </p>
                </>
              )}
              {tk && tk.addOns.length > 0 && (
                <>
                  <div className="mx-3 border-t-2 border-dashed border-ink/10" />
                  <ul className="space-y-2 p-3 pt-2">
                    {tk.addOns.map((a) => {
                      const qty = box.addOns[a.code] ?? a.included;
                      const extra = Math.max(0, qty - a.included) * a.extraPrice;
                      const spoken = `${a.name} — ${label}`;
                      // The row is silent at what the ticket includes; only
                      // extras get a price line. Why a tap at a bound did
                      // nothing arrives as a notice under the row instead.
                      const price = extra > 0 ? `+${baht(extra)}` : qty > a.included ? t("free") : "";
                      const priceTone = `font-display ${c.text}`;
                      const atMin = qty <= a.included;
                      const atMax = qty >= a.max;
                      const rowNotice =
                        notice && notice.boxId === box.id && notice.code === a.code ? notice.text : null;
                      return (
                        <li key={a.code}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="min-w-0">
                              <span className="block font-display text-sm text-ink">{a.name}</span>
                              {price && <span className={`block text-xs ${priceTone}`}>{price}</span>}
                            </span>
                            <span className="flex items-center gap-2">
                              <button
                                type="button"
                                aria-label={`${t("quantity")} − ${spoken}`}
                                aria-disabled={atMin}
                                onClick={() => stepAddOn(box.id, a, -1)}
                                className={`${stepBtn} border-ink/15 text-ink hover:border-ink/40 ${atMin ? "opacity-30" : ""}`}
                              >
                                −
                              </button>
                              <span aria-live="polite" className="w-6 text-center font-display text-lg text-ink">
                                {qty}
                              </span>
                              <button
                                type="button"
                                aria-label={`${t("quantity")} + ${spoken}`}
                                aria-disabled={atMax}
                                onClick={() => stepAddOn(box.id, a, 1)}
                                className={`${stepBtn} ${qty > a.included ? `${c.border} ${c.text}` : "border-ink/15 text-ink hover:border-ink/40"} ${atMax ? "opacity-30" : ""}`}
                              >
                                +
                              </button>
                            </span>
                          </div>
                          {rowNotice && (
                            <p role="status" className="mt-1 text-right text-xs text-tomato">
                              {rowNotice}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addBox}
        disabled={!canAdd}
        className="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-ink/20 px-4 py-2 font-display text-sm text-ink/70 transition-colors hover:border-ink/45 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink disabled:opacity-40"
      >
        <span aria-hidden>+</span> {t("addTicket")}
      </button>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-ink/60">{t("total")}</span>
        <span className="font-display text-xl text-ink">
          {total === 0 && complete ? t("free") : baht(total)}
        </span>
      </div>

      {(() => {
        // Shape and focus ring only. Spacing, size and colour belong to each
        // caller: two competing utilities of the same property in one class
        // string resolve by stylesheet order, not by which is written last.
        const pill =
          "block w-full rounded-full px-7 text-center transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";
        const primary = "py-3 text-lg hover:scale-[1.02]";
        const cta = `mt-4 ${pill} ${primary} ${c.bg} ${c.on}`;
        // LINE's own green, on ink rather than paper: white on this green is
        // only 2.3:1, which fails AA even at this size, while ink clears 9:1.
        const lineCta = `mt-4 ${pill} ${primary} bg-line text-ink`;

        // Card-only event: a single button.
        if (!chatCheckout) {
          return (
            <button
              type="button"
              disabled={!complete}
              onClick={() => setModalOpen(true)}
              className={`${cta} disabled:opacity-40 disabled:hover:scale-100`}
            >
              {t("getTickets")}
            </button>
          );
        }

        const ready = intent?.sig === sig ? intent.lineUrl : null;
        return (
          <>
            {!complete ? (
              <button
                type="button"
                disabled
                className={`mt-4 ${pill} py-3 text-lg bg-line text-ink opacity-40`}
              >
                {t("payWithLine")}
              </button>
            ) : desktop && ready ? (
              // Desktop reveals the code only after the buyer commits, so no
              // intent is created just by assembling tickets.
              <LineQrPanel lineUrl={ready} />
            ) : (
              <button
                type="button"
                onClick={startLineCheckout}
                aria-disabled={startingLine}
                className={`${lineCta} ${startingLine ? "cursor-wait opacity-70" : ""}`}
              >
                {startingLine ? t("openingLine") : t("payWithLine")}
              </button>
            )}

            {/* Shown only when the deep link was fired and this page never
                went away: a plain anchor the buyer presses themselves. */}
            {handoffFailed && ready && (
              <div className="mt-3 rounded-2xl border-2 border-ink/10 p-4 text-center">
                <p className="text-xs leading-relaxed text-ink/70">{t("openLineManuallyHint")}</p>
                <a href={ready} className={`mt-3 ${pill} py-2.5 text-base bg-line text-ink`}>
                  {t("openLineManually")}
                </a>
              </div>
            )}

            {/* The way in for buyers without LINE — an outlined pill, secondary
                by weight but still unmistakably a control. */}
            {cardCheckout && (
              <button
                type="button"
                disabled={!complete}
                onClick={() => setModalOpen(true)}
                className={`mt-3 ${pill} border-2 border-ink/20 py-2.5 text-base text-ink/80 hover:border-ink/45 hover:text-ink disabled:opacity-40`}
              >
                {t("payWithCard")}
              </button>
            )}
          </>
        );
      })()}

      {refundPolicy?.termTh && (
        // Required next to the checkout button. Thai term only, by the client's
        // choice — ink/60 is the lightest tint that still clears AA at this size.
        <div className="mt-3 text-xs leading-relaxed text-ink/60">
          <span className="font-display text-ink/75">{t("refundPolicy")}</span>{" "}
          {refundPolicy.termTh}
        </div>
      )}

      {modalOpen && (
        <AttendeeFormModal
          color={color}
          fields={purchaseForm}
          unitGroups={unitGroups}
          submitting={submitting}
          onConfirm={confirmOrder}
          onClose={() => {
            if (!submitting) setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
