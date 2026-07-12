"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";

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

/** In-app ticket purchase for v4. Fetches live availability through our own
 *  API routes (the platform key never reaches the browser), then hands the
 *  buyer to Stripe Checkout. Falls back to the external link if the ticket
 *  service is unreachable. */
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
  const [email, setEmail] = useState("");
  const [principal, setPrincipal] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canSubmit = count > 0 && emailOk && principal.trim().length > 0 && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/v4/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          email: email.trim(),
          principal: principal.trim(),
          items: Object.entries(qty)
            .filter(([, quantity]) => quantity > 0)
            .map(([code, quantity]) => ({ code, quantity })),
        }),
      });
      const data = (await res.json()) as { checkoutUrl?: string | null; error?: string };
      if (!res.ok) {
        setError(data.error ?? t("ticketsUnavailable"));
        setSubmitting(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.assign(data.checkoutUrl); // paid order → Stripe Checkout
      } else {
        router.push("/v4/checkout/success"); // free order — already PAID
      }
    } catch {
      setError(t("ticketsUnavailable"));
      setSubmitting(false);
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
    <form onSubmit={submit}>
      <h2 className="font-display text-lg text-ink">{t("tickets")}</h2>

      <ul className="mt-3 space-y-3">
        {tickets.map((tk) => {
          const max = Math.min(tk.limitPerOrder, tk.available);
          const soldOut = tk.available === 0;
          return (
            <li key={tk.code} className="rounded-xl border-2 border-ink/10 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-ink">{tk.name}</span>
                <span className={`font-display text-sm ${c.text}`}>
                  {tk.price === 0 ? t("free") : baht(tk.price)}
                </span>
              </div>
              {soldOut ? (
                <p className="mt-1 text-xs text-tomato">{t("soldOut")}</p>
              ) : (
                <div className="mt-2 flex items-center justify-between gap-2">
                  <label htmlFor={`qty-${tk.code}`} className="text-xs text-ink/60">
                    {t("quantity")}
                  </label>
                  <select
                    id={`qty-${tk.code}`}
                    value={qty[tk.code] ?? 0}
                    onChange={(e) =>
                      setQty((q) => ({ ...q, [tk.code]: Number(e.target.value) }))
                    }
                    className="rounded-lg border-2 border-ink/15 bg-paper px-2 py-1 text-sm"
                  >
                    {Array.from({ length: max + 1 }, (_, n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  {tk.available <= 10 && (
                    <span className="text-xs text-ink/50">
                      {tk.available} {t("ticketsLeft")}
                    </span>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="mt-4 space-y-3">
        <div>
          <label htmlFor="tp-name" className="block text-xs text-ink/60">
            {t("attendeeName")}
          </label>
          <input
            id="tp-name"
            type="text"
            required
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-paper px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label htmlFor="tp-email" className="block text-xs text-ink/60">
            {t("buyerEmail")}
          </label>
          <input
            id="tp-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border-2 border-ink/15 bg-paper px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <span className="text-sm text-ink/60">{t("total")}</span>
        <span className="font-display text-xl text-ink">
          {total === 0 && count > 0 ? t("free") : baht(total)}
        </span>
      </div>

      {error && (
        <p className="mt-3 text-sm text-tomato" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!canSubmit}
        className={`mt-4 w-full rounded-full px-7 py-3 text-lg ${c.bg} ${c.on} transition-opacity disabled:opacity-40`}
      >
        {submitting ? t("processingOrder") : t("getTickets")}
      </button>
    </form>
  );
}
