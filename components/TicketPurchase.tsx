"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t, formatDate } from "@/lib/i18n";
import AttendeeFormModal, { type AttendeeForm } from "@/components/AttendeeFormModal";

interface TicketOption {
  code: string;
  name: string;
  /** Organizer's section label for anything that is NOT time — zone, tier,
   *  package. null = ungrouped. The session lives in sessionDate. */
  group: string | null;
  /** Satang; 0 = free. */
  price: number;
  limitPerOrder: number;
  available: number;
  /** Calendar day the ticket admits on (YYYY-MM-DD, resolved by the platform
   *  in Asia/Bangkok), or null for an event with no sessions. */
  sessionDate: string | null;
}

interface RefundPolicy {
  allowed: boolean;
  termEn: string;
  termTh: string;
}

interface TicketSection {
  sessionDate: string | null;
  group: string | null;
  /** Rendered day label, or null when the section continues the day above. */
  heading: string | null;
  items: TicketOption[];
}

function baht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

/** The platform sections tickets on two independent axes: `sessionDate` (when
 *  the ticket admits you) is the outer one, `group` (zone / tier / package) the
 *  inner one. Options with neither render flat and first, with no heading.
 *  Everything else keeps the platform's order — never re-sort — and opens a new
 *  section whenever either axis changes. */
function toSections(tickets: TicketOption[]): TicketSection[] {
  const ungrouped = tickets.filter((tk) => !tk.sessionDate && !tk.group);
  const sections: TicketSection[] = ungrouped.length
    ? [{ sessionDate: null, group: null, heading: null, items: ungrouped }]
    : [];
  for (const tk of tickets) {
    if (!tk.sessionDate && !tk.group) continue;
    const last = sections[sections.length - 1];
    if (last && last.sessionDate === tk.sessionDate && last.group === tk.group) {
      last.items.push(tk);
    } else {
      sections.push({
        sessionDate: tk.sessionDate,
        group: tk.group,
        // Only the first section of a day is titled; later zones sit under it.
        heading: tk.sessionDate && tk.sessionDate !== last?.sessionDate ? dayLabel(tk.sessionDate) : null,
        items: [tk],
      });
    }
  }
  return sections;
}

/** The API deliberately sends no human-readable session label — only we know
 *  the reader's language. Built from `sessionDate` rather than the raw instant
 *  so a late session can't land on the previous day in a browser outside
 *  Bangkok. */
function dayLabel(sessionDate: string): string {
  return `${t("sessionOn")} ${formatDate(sessionDate)}`;
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
  const [failed, setFailed] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/tickets?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { tickets: TicketOption[]; refundPolicy: RefundPolicy | null }) => {
        if (!alive) return;
        setTickets(data.tickets);
        setRefundPolicy(data.refundPolicy);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [slug]);

  const total = (tickets ?? []).reduce((sum, tk) => sum + (qty[tk.code] ?? 0) * tk.price, 0);
  const count = Object.values(qty).reduce((a, b) => a + b, 0);

  function step(code: string, delta: number, max: number) {
    setQty((q) => ({ ...q, [code]: Math.min(max, Math.max(0, (q[code] ?? 0) + delta)) }));
  }

  async function confirmOrder(form: AttendeeForm): Promise<string | null> {
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: form.name.trim(),
          childName: form.childName.trim(),
          email: form.email.trim(),
          contact: form.contact.trim(),
          items: Object.entries(qty)
            .filter(([, quantity]) => quantity > 0)
            .map(([code, quantity]) => ({ code, quantity })),
        }),
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
              className="relative animate-pulse overflow-hidden rounded-2xl border-2 border-ink/10 pl-4"
              style={{ animationDelay: `${i * 150}ms` }}
            >
              <span className={`absolute inset-y-0 left-0 w-2 ${c.soft}`} />
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
        <section key={`${i}-${section.sessionDate ?? ""}-${section.group ?? ""}`} className="mt-3">
          {/* Outer axis: the day this ticket admits on. */}
          {section.heading && (
            <h3 className={`mb-2 font-display text-sm ${c.text}`}>{section.heading}</h3>
          )}
          {/* Inner axis: the organizer's own label (zone, tier, package). */}
          {section.group && (
            <h4 className="mb-2 text-xs text-ink/60">{section.group}</h4>
          )}
          <ul className="space-y-3">
            {section.items.map((tk) => {
              const max = Math.min(tk.limitPerOrder, tk.available);
              const selected = (qty[tk.code] ?? 0) > 0;
              const soldOut = tk.available === 0;
              return (
                <li
                  key={tk.code}
                  className={`relative overflow-hidden rounded-2xl border-2 pl-4 transition-colors ${soldOut
                    ? "border-ink/10 opacity-60"
                    : selected
                      ? `${c.border} ${c.soft}`
                      : "border-ink/10 hover:border-ink/25"
                    }`}
                >
                  {/* Ticket-stub spine. */}
                  <span aria-hidden className={`absolute inset-y-0 left-0 w-2 ${c.bg}`} />
    
                  <div className="flex items-baseline justify-between gap-2 p-3 pb-2">
                    <span className="font-display text-base text-ink">{tk.name}</span>
                    <span
                      className={`shrink-0 rounded-full px-3 py-0.5 font-display text-sm ${soldOut ? "bg-ink/10 text-ink/60" : `${c.bg} ${c.on}`
                        }`}
                    >
                      {tk.price === 0 ? t("free") : baht(tk.price)}
                    </span>
                  </div>
    
                  <div className="mx-3 border-t-2 border-dashed border-ink/10" />
    
                  {soldOut ? (
                    <p className="p-3 pt-2 font-display text-sm text-tomato">{t("soldOut")}</p>
                  ) : (
                    <div className="flex items-center justify-between gap-2 p-3 pt-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          aria-label={`${t("quantity")} − ${tk.name}`}
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
                          aria-label={`${t("quantity")} + ${tk.name}`}
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

      <button
        type="button"
        disabled={count === 0}
        onClick={() => setModalOpen(true)}
        className={`mt-4 w-full rounded-full px-7 py-3 text-lg ${c.bg} ${c.on} transition-all hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40 disabled:hover:scale-100`}
      >
        {t("getTickets")}
      </button>

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
