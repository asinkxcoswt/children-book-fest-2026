"use client";

import { useEffect, useState } from "react";
import type { ColorToken } from "@/types/content";
import { t } from "@/lib/i18n";
import TicketCard from "@/components/v4/TicketCard";

type Phase = "checking" | "paid" | "pending" | "expired" | "notFound";

interface StatusResponse {
  status: string;
  email: string;
  event: {
    title: string;
    dateDisplay: string;
    venue: string;
    color: ColorToken;
    festivalName: string;
  } | null;
  tickets: { id: string; principal: string }[];
}

const POLL_MS = 2000;
const TIMEOUT_MS = 60000;

/** Polls our order-status route until the platform confirms payment, then
 *  renders the issued tickets as saveable QR images.
 *  Never trusts the Stripe redirect alone (see integration-guide.md §4.5). */
export default function OrderStatus() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [order, setOrder] = useState<StatusResponse | null>(null);

  useEffect(() => {
    let alive = true;
    const startedAt = Date.now();

    async function poll() {
      if (!alive) return;
      try {
        const res = await fetch("/api/v4/orders/status");
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
  }, []);

  if (phase === "checking") {
    return <p className="text-lg text-ink/70" role="status">{t("checkingOrder")}</p>;
  }
  if (phase === "paid") {
    const event = order?.event;
    return (
      <div role="status">
        <p className="text-lg text-meadow">{t("orderPaid")}</p>
        {order?.email && (
          <p className="mt-2 text-sm text-ink/60">
            {t("ticketsEmailedTo")} {order.email}
          </p>
        )}

        {event && order.tickets.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl text-ink">{t("yourTickets")}</h2>
            <div className="mt-5 flex flex-wrap gap-8">
              {order.tickets.map((tk) => (
                <TicketCard
                  key={tk.id}
                  ticket={{
                    ticketId: tk.id,
                    principal: tk.principal,
                    eventTitle: event.title,
                    dateDisplay: event.dateDisplay,
                    venue: event.venue,
                    festivalName: event.festivalName,
                    color: event.color,
                  }}
                />
              ))}
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
  return <p className="text-lg text-ink/70">{t("orderNotFound")}</p>;
}
