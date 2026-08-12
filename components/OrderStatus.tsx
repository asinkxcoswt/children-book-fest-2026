"use client";

import { useEffect, useState } from "react";
import type { ColorToken } from "@/types/content";
import { t } from "@/lib/i18n";
import TicketPocket from "@/components/TicketPocket";

type Phase = "checking" | "paid" | "pending" | "expired" | "refunded" | "notFound";

interface StatusResponse {
  status: string;
  /** Human-friendly order reference (CT-XXXXXX). */
  orderNo: string;
  email: string;
  event: {
    title: string;
    dateDisplay: string;
    venue: string;
    color: ColorToken;
    festivalName: string;
  } | null;
  tickets: { ticketNo: string; principal: string }[];
}

const POLL_MS = 2000;
const TIMEOUT_MS = 60000;

/** Polls our order-status route until the platform confirms payment, then
 *  renders the issued tickets as saveable QR images.
 *  Never trusts the Stripe redirect alone (see integration-guide.md §4.5). */
export default function OrderStatus({ orderId, token }: { orderId?: string; token?: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [order, setOrder] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();

    async function poll() {
      if (!alive) return;
      try {
        const query = new URLSearchParams();
        if (orderId) query.set("orderId", orderId);
        if (token) query.set("token", token);
        const res = await fetch(`/api/orders/status?${query.toString()}`);
        if (res.status === 404) {
          if (alive) setPhase("notFound");
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as StatusResponse;
          if (!alive) return;
          setOrder(data);
          if (data.status === "PAID") {
            setPhase("paid");
            return;
          }
          if (data.status === "EXPIRED" || data.status === "CANCELED") {
            setPhase("expired");
            return;
          }
          if (data.status === "REFUNDED") {
            // Terminal too — the tickets are void, so stop polling.
            setPhase("refunded");
            return;
          }
        }
      } catch {
        // transient — keep polling until timeout
      }
      if (Date.now() - startedAt >= TIMEOUT_MS) {
        // Webhook may just be slow — reassure, don't error.
        if (alive) setPhase("pending");
        return;
      }
      setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      alive = false;
    };
  }, [orderId, token]);

  if (phase === "checking") {
    // Big, obviously-alive loading state: spinner ring + pulsing ticket skeleton.
    return (
      <div role="status" aria-label={t("checkingOrder")} className="py-6">
        <div className="flex items-center gap-4">
          <span
            aria-hidden
            className="h-10 w-10 shrink-0 animate-spin rounded-full border-4 border-ink/10 border-t-tomato"
          />
          <div>
            <p className="font-display text-xl text-ink">{t("checkingOrder")}</p>
            <span aria-hidden className="mt-1 flex gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 animate-bounce rounded-full bg-tomato"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </span>
          </div>
        </div>

        {/* Ticket-shaped skeleton where the real tickets will appear. */}
        <div aria-hidden className="mt-8 max-w-xs">
          <div className="animate-pulse overflow-hidden rounded-3xl border-2 border-ink/10">
            <div className="h-24 bg-ink/10" />
            <div className="flex flex-col items-center gap-3 p-6">
              <div className="h-36 w-36 rounded-2xl bg-ink/10" />
              <div className="h-4 w-32 rounded-full bg-ink/10" />
              <div className="h-3 w-40 rounded-full bg-ink/5" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (phase === "paid") {
    const event = order?.event;
    return (
      <div role="status">
        <p className="flex items-center gap-3 font-display text-2xl text-ink">
          <span
            aria-hidden
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-meadow text-base text-paper"
          >
            ✓
          </span>
          {t("orderPaid")}
        </p>
        {order?.orderNo && (
          <p className="mt-4">
            <span className="inline-block rounded-lg border-2 border-dashed border-ink/30 px-3 py-1 font-display tracking-widest text-ink">
              {t("orderNumber")} {order.orderNo}
            </span>
          </p>
        )}
        {order?.email && (
          <p className="mt-2 text-sm text-ink/60">
            {t("ticketsEmailedTo")} {order.email}
          </p>
        )}

        {event && order.tickets.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">{t("yourTickets")}</h2>
            <div className="mt-6">
              <TicketPocket
                tickets={order.tickets.map((tk) => ({
                  ticketNo: tk.ticketNo,
                  principal: tk.principal,
                  eventTitle: event.title,
                  dateDisplay: event.dateDisplay,
                  venue: event.venue,
                  festivalName: event.festivalName,
                  color: event.color,
                }))}
              />
            </div>
          </section>
        )}
      </div>
    );
  }
  if (phase === "pending") {
    return <p className="text-lg text-ink/70" role="status">{t("orderPending")}</p>;
  }
  if (phase === "expired") {
    return <p className="text-lg text-tomato" role="alert">{t("orderExpired")}</p>;
  }
  if (phase === "refunded") {
    return <p className="text-lg text-tomato" role="alert">{t("orderRefunded")}</p>;
  }
  return <p className="text-lg text-ink/70">{t("orderNotFound")}</p>;
}
