"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t, formatDate, formatTimeRange } from "@/lib/i18n";
import type { PaymentMethod, PurchaseFormField } from "@/lib/ticketApi";
import AttendeeFormModal, { type PurchaseAnswers } from "@/components/AttendeeFormModal";
import LineQrPanel from "@/components/LineQrPanel";

interface TicketOption {
  code: string;
  /** The round number ("รอบที่ 1"); the day and time come from the session. */
  name: string;
  /** Organizer's section label for anything that is NOT time — zone, tier,
   *  package. null = ungrouped. The session lives in sessionDate. */
  group: string | null;
  /** Satang; 0 = free. */
  price: number;
  limitPerOrder: number;
  available: number;
  /** Calendar day the ticket admits on (YYYY-MM-DD, resolved by the platform
   *  in Asia/Bangkok), or null for an event with no sessions. Label the card
   *  from this, not from the raw `sessionStartAt` instant — a late session
   *  formatted in a browser outside Bangkok can land on the previous day. */
  sessionDate: string | null;
  /** When the ticket admits you (ISO instants). The card leads with this
   *  rather than repeating it in `name`, so the time has one source and can't
   *  drift out of sync with what the gate honours. */
  sessionStartAt: string | null;
  sessionEndAt: string | null;
}

interface RefundPolicy {
  allowed: boolean;
  termEn: string;
  termTh: string;
}

interface TicketSection {
  group: string | null;
  items: TicketOption[];
}

function baht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

/** Sections come from `group` alone — the organizer's own label for zone, tier
 *  or package. The other axis, the day a ticket admits on, is printed on each
 *  ticket instead of heading a section: every event here sells one ticket per
 *  day, so a heading per card would be one line of chrome for one line of
 *  content, and a date on the card can't be scrolled past.
 *
 *  Ungrouped options render flat and first, with no heading. Platform order is
 *  preserved throughout — never re-sort. */
function toSections(tickets: TicketOption[]): TicketSection[] {
  const ungrouped = tickets.filter((tk) => !tk.group);
  const sections: TicketSection[] = ungrouped.length ? [{ group: null, items: ungrouped }] : [];
  for (const tk of tickets) {
    if (!tk.group) continue;
    const last = sections[sections.length - 1];
    if (last && last.group === tk.group) last.items.push(tk);
    else sections.push({ group: tk.group, items: [tk] });
  }
  return sections;
}

/** In-app ticket purchase. Buyers pick quantities on ticket-stub cards,
 *  then fill in attendee details in a confirmation modal; the order is created
 *  through our own API routes and paid on Stripe Checkout. Falls back to the
 *  external link if the ticket service is unreachable. */
export default function TicketPurchase({
  slug,
  color,
  fallbackUrl,
}: {
  slug: string;
  color: ColorToken;
  fallbackUrl: string;
}) {
  const router = useRouter();
  const c = tokenClasses(color);

  const [tickets, setTickets] = useState<TicketOption[] | null>(null);
  const [refundPolicy, setRefundPolicy] = useState<RefundPolicy | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [purchaseForm, setPurchaseForm] = useState<PurchaseFormField[]>([]);
  const [failed, setFailed] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /** Chat-checkout link for the current selection. Kept keyed by `sig` so a
   *  stale link can never be followed after the buyer changes quantities. */
  const [intent, setIntent] = useState<{ sig: string; lineUrl: string } | null>(null);
  const [startingLine, setStartingLine] = useState(false);
  /** Set when the deep link was fired but this page never went away. */
  const [handoffFailed, setHandoffFailed] = useState(false);
  /** A LINE deep link needs the app on the same device, so desktop gets a QR
   *  instead. Detected from the pointer rather than the user agent, and only
   *  after mount — false on the server keeps the mobile path flash-free, which
   *  is the one that matters most. */
  const [desktop, setDesktop] = useState(false);

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
          setTickets(data.tickets);
          setRefundPolicy(data.refundPolicy);
          setPaymentMethods(data.paymentMethods ?? []);
          setPurchaseForm(data.purchaseForm ?? []);
        },
      )
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const total = (tickets ?? []).reduce((sum, tk) => sum + (qty[tk.code] ?? 0) * tk.price, 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  const chatCheckout = paymentMethods.includes("PROMPTPAY");
  const cardCheckout = paymentMethods.includes("STRIPE");

  const selection = Object.entries(qty)
    .filter(([, quantity]) => quantity > 0)
    .map(([code, quantity]) => ({ code, quantity }));
  const sig = selection.map((i) => `${i.code}:${i.quantity}`).join(",");

  function step(code: string, delta: number, max: number) {
    setQty((q) => ({ ...q, [code]: Math.min(max, Math.max(0, (q[code] ?? 0) + delta)) }));
  }

  /** Creates the chat purchase, on click only. An intent is a real record on the
   *  platform, so one is made per deliberate purchase attempt — never per
   *  quantity tweak. The result is cached against the current selection, so
   *  clicking again without changing the basket reuses it rather than issuing
   *  another. */
  async function startLineCheckout() {
    if (startingLine) return;
    if (intent?.sig === sig) return handoff(intent.lineUrl);
    setStartingLine(true);
    setHandoffFailed(false);
    try {
      const res = await fetch("/api/orders/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, items: selection }),
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

  /** Desktop scans a code; everywhere else we navigate to the deep link.
   *
   *  The link is an ordinary https universal link, so navigating after an await
   *  is fine in nearly every browser — but a few in-app webviews swallow it. So
   *  rather than sniffing for those, watch what happens: if this page is still
   *  in front shortly afterwards, the navigation didn't take, and we offer a
   *  plain anchor for the buyer to press themselves. */
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

  async function confirmOrder(answers: PurchaseAnswers): Promise<string | null> {
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, answers, items: selection }),
      });
      const data = (await res.json()) as { checkoutUrl?: string | null; error?: string; orderId?: string; token?: string };
      if (!res.ok) {
        setSubmitting(false);
        return data.error ?? t("ticketsUnavailable");
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl); // paid order → Stripe Checkout
      } else if (data.orderId && data.token) {
        router.push(`/checkout/success?orderId=${encodeURIComponent(data.orderId)}&token=${encodeURIComponent(data.token)}`); // free order — already PAID
      } else {
        router.push("/checkout/success"); // fallback
      }
      return null; // navigating away; keep the modal in its busy state
    } catch {
      setSubmitting(false);
      return t("ticketsUnavailable");
    }
  }

  if (failed) {
    // Ticket service unreachable — fall back to the external registration link.
    return (
      <div>
        <p className="text-sm text-ink/60">{t("ticketsUnavailable")}</p>
        <a
          href={fallbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`mt-3 inline-flex items-center gap-2 rounded-full px-7 py-3 text-lg ${c.bg} ${c.on}`}
        >
          {t("register")} <span aria-hidden>↗</span>
        </a>
      </div>
    );
  }

  if (!tickets) {
    // Skeleton mirroring the ticket-stub cards so the sidebar doesn't jump.
    return (
      <div role="status" aria-label={t("loadingTickets")}>
        <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>
        <ul className="mt-3 space-y-3" aria-hidden>
          {[0, 1].map((i) => (
            <li
              key={i}
              className={`relative animate-pulse overflow-hidden rounded-2xl border-y-2 border-r-2 border-l-8 border-y-ink/10 border-r-ink/10 pl-2 ${c.edge} opacity-40`}
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <div className="flex items-center justify-between gap-2 p-3 pb-2">
                <span className="h-4 w-24 rounded-full bg-ink/10" />
                <span className={`h-6 w-14 rounded-full ${c.soft}`} />
              </div>
              <div className="mx-3 border-t-2 border-dashed border-ink/10" />
              <div className="flex items-center gap-2 p-3 pt-2">
                <span className="h-8 w-8 rounded-full border-2 border-ink/10" />
                <span className="h-4 w-6 rounded bg-ink/10" />
                <span className="h-8 w-8 rounded-full border-2 border-ink/10" />
              </div>
            </li>
          ))}
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

  return (
    <div>
      <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>

      {toSections(tickets).map((section, i) => (
        <section key={`${i}-${section.group ?? ""}`} className="mt-3">
          {/* The organizer's own label — zone, tier, package. */}
          {section.group && (
            <h3 className={`mb-2 font-display text-sm ${c.text}`}>{section.group}</h3>
          )}
          <ul className="space-y-3">
            {section.items.map((tk) => {
              const max = Math.min(tk.limitPerOrder, tk.available);
              const selected = (qty[tk.code] ?? 0) > 0;
              const soldOut = tk.available === 0;
              const time = tk.sessionStartAt
                ? formatTimeRange(tk.sessionStartAt, tk.sessionEndAt)
                : "";
              // Screen readers get the whole ticket, not just its name: "รอบที่ 1"
              // alone gives no way to tell which day's ticket is being stepped.
              const spoken = [tk.sessionDate && formatDate(tk.sessionDate), time, tk.name]
                .filter(Boolean)
                .join(" ");
              // Ticket-stub spine drawn as the left border, not an inner bar:
              // inside a 2px box the colour stopped short of the card edge and the
              // grey outline wrapped around it. As a border it reaches the edge and
              // follows the corner radius. Sides are addressed individually
              // (border-y/-r/-l) so no shorthand competes with the left edge — that
              // conflict resolves by stylesheet order, not by what is written last.
              return (
                <li
                  key={tk.code}
                  className={`relative overflow-hidden rounded-2xl border-y-2 border-r-2 border-l-8 ${c.edge} pl-2 transition-colors ${soldOut
                    ? "border-y-ink/10 border-r-ink/10 opacity-60"
                    : selected
                      ? `border-y-ink/10 border-r-ink/10 ${c.soft}`
                      : "border-y-ink/10 border-r-ink/10 hover:border-y-ink/25 hover:border-r-ink/25"
                    }`}
                >
                  <div className="p-3 pb-2">
                    {/* The day this ticket admits on — never only the time, or a
                        buyer can turn up on the wrong day. */}
                    {tk.sessionDate && (
                      <p className={`font-display text-xs ${c.text}`}>{formatDate(tk.sessionDate)}</p>
                    )}
                    <div className="flex items-baseline justify-between gap-2">
                      {/* Tickets with no session fall back to their name, which
                          is then the only label they have. */}
                      <span className="font-display text-base text-ink">
                        {time || tk.name}
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-3 py-0.5 font-display text-sm ${soldOut ? "bg-ink/10 text-ink/60" : `${c.bg} ${c.on}`
                          }`}
                      >
                        {tk.price === 0 ? t("free") : baht(tk.price)}
                      </span>
                    </div>
                    {time && (
                      <p className="text-xs text-ink/60">{tk.name}</p>
                    )}
                  </div>

                  <div className="mx-3 border-t-2 border-dashed border-ink/10" />
    
                  {soldOut ? (
                    <p className="p-3 pt-2 font-display text-sm text-tomato">{t("soldOut")}</p>
                  ) : (
                    <div className="flex items-center justify-between gap-2 p-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${t("quantity")} − ${spoken}`}
                          disabled={(qty[tk.code] ?? 0) === 0}
                          onClick={() => step(tk.code, -1, max)}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-ink/15 font-display text-lg text-ink transition-colors hover:border-ink/40 disabled:opacity-30"
                        >
                          −
                        </button>
                        <span aria-live="polite" className="w-6 text-center font-display text-lg text-ink">
                          {qty[tk.code] ?? 0}
                        </span>
                        <button
                          type="button"
                          aria-label={`${t("quantity")} + ${spoken}`}
                          disabled={(qty[tk.code] ?? 0) >= max}
                          onClick={() => step(tk.code, 1, max)}
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-lg transition-colors disabled:opacity-30 ${selected ? `${c.border} ${c.text}` : "border-ink/15 text-ink hover:border-ink/40"
                            }`}
                        >
                          +
                        </button>
                      </div>
                      <span className="text-right text-xs text-ink/50">
                        {tk.available <= 10
                          ? `${tk.available} ${t("ticketsLeft")}`
                          : `${tk.limitPerOrder} ${t("perOrderLimit")}`}
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-ink/60">{t("total")}</span>
        <span className="font-display text-xl text-ink">
          {total === 0 && count > 0 ? t("free") : baht(total)}
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

        // Card-only event: the original single button, unchanged.
        if (!chatCheckout) {
          return (
            <button
              type="button"
              disabled={count === 0}
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
            {count === 0 ? (
              <button
                type="button"
                disabled
                className={`mt-4 ${pill} py-3 text-lg bg-line text-ink opacity-40`}
              >
                {t("payWithLine")}
              </button>
            ) : desktop && ready ? (
              // Desktop reveals the code only after the buyer commits, so no
              // intent is created just by choosing quantities.
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

            {/* Step two, shown only to the buyers who needed it: the deep link
                was fired and this page never went away, so the webview swallowed
                it. A plain anchor they press themselves gets through. */}
            {handoffFailed && ready && (
              <div className="mt-3 rounded-2xl border-2 border-ink/10 p-4 text-center">
                <p className="text-xs leading-relaxed text-ink/70">{t("openLineManuallyHint")}</p>
                <a href={ready} className={`mt-3 ${pill} py-2.5 text-base bg-line text-ink`}>
                  {t("openLineManually")}
                </a>
              </div>
            )}

            {/* The way in for buyers without LINE. An outlined pill rather than a
                sentence: as running text it read as part of the refund policy
                below it, which is the one thing next to it that must stay
                readable. Secondary by weight, still unmistakably a control. */}
            {cardCheckout && (
              <button
                type="button"
                disabled={count === 0}
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
