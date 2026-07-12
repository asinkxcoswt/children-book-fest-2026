"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";
import AttendeeFormModal, { type AttendeeForm } from "@/components/v4/AttendeeFormModal";

interface TicketOption {
  code: string;
  name: string;
  /** Satang; 0 = free. */
  price: number;
  limitPerOrder: number;
  available: number;
}

function baht(satang: number): string {
  return `฿${(satang / 100).toLocaleString("th-TH")}`;
}

/** In-app ticket purchase for v4. Buyers pick quantities on ticket-stub cards,
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
  const [failed, setFailed] = useState(false);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/v4/tickets?slug=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((data: { tickets: TicketOption[] }) => {
        if (alive) setTickets(data.tickets);
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
      const res = await fetch("/api/v4/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: form.name.trim(),
          childName: form.childName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          items: Object.entries(qty)
            .filter(([, quantity]) => quantity > 0)
            .map(([code, quantity]) => ({ code, quantity })),
        }),
      });
      const data = (await res.json()) as { checkoutUrl?: string | null; error?: string };
      if (!res.ok) {
        setSubmitting(false);
        return data.error ?? t("ticketsUnavailable");
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl); // paid order → Stripe Checkout
      } else {
        router.push("/v4/checkout/success"); // free order — already PAID
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
    return <p className="text-sm text-ink/60" role="status">{t("loadingTickets")}</p>;
  }

  return (
    <div>
      <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>

      <ul className="mt-3 space-y-3">
        {tickets.map((tk) => {
          const max = Math.min(tk.limitPerOrder, tk.available);
          const selected = (qty[tk.code] ?? 0) > 0;
          const soldOut = tk.available === 0;
          return (
            <li
              key={tk.code}
              className={`relative overflow-hidden rounded-2xl border-2 pl-4 transition-colors ${
                soldOut
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
                  className={`shrink-0 rounded-full px-3 py-0.5 font-display text-sm ${
                    soldOut ? "bg-ink/10 text-ink/60" : `${c.bg} ${c.on}`
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
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 font-display text-lg transition-colors disabled:opacity-30 ${
                        selected ? `${c.border} ${c.text}` : "border-ink/15 text-ink hover:border-ink/40"
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
        className={`mt-4 w-full rounded-full px-7 py-3 text-lg ${c.bg} ${c.on} transition-all hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100`}
      >
        {t("getTickets")}
      </button>

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
