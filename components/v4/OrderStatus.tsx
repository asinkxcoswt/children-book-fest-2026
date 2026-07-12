"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";

type Phase = "checking" | "paid" | "pending" | "expired" | "notFound";

const POLL_MS = 2000;
const TIMEOUT_MS = 60000;

/** Polls our order-status route until the platform confirms payment.
 *  Never trusts the Stripe redirect alone (see integration-guide.md §4.5). */
export default function OrderStatus() {
  const [phase, setPhase] = useState<Phase>("checking");
  const [email, setEmail] = useState<string | null>(null);

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
          const data = (await res.json()) as { status: string; email: string };
          if (!alive) return;
          setEmail(data.email);
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
    return (
      <div role="status">
        <p className="text-lg text-meadow">{t("orderPaid")}</p>
        {email && (
          <p className="mt-2 text-sm text-ink/60">
            {t("ticketsEmailedTo")} {email}
          </p>
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
