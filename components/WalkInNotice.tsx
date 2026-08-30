import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";

/** Sidebar panel for free walk-in events — nothing is sold, so this replaces
 *  the purchase UI entirely (server-rendered; the ticket API is never called).
 *  Deliberately styled as one of the ticket-stub cards — same spine,
 *  perforation and price pill — so the eye lands where tickets always live and
 *  reads "this is the ticket slot, and you don't need one". */
export default function WalkInNotice({
  color,
  limitedSeats,
}: {
  color: ColorToken;
  /** Show the first-come-first-served note (events with a shown capacity). */
  limitedSeats?: boolean;
}) {
  const c = tokenClasses(color);

  return (
    <div>
      <h2 className="font-display text-lg text-ink">{t("walkInTitle")}</h2>
      <div
        className={`relative mt-3 overflow-hidden rounded-2xl border-y-2 border-r-2 border-l-8 border-y-ink/10 border-r-ink/10 ${c.edge} pl-2 ${c.soft}`}
      >
        <div className="flex items-baseline justify-between gap-2 p-3 pb-2">
          <span className="font-display text-base text-ink">{t("walkInNoTicket")}</span>
          <span className={`shrink-0 rounded-full px-3 py-0.5 font-display text-sm ${c.bg} ${c.on}`}>
            {t("free")}
          </span>
        </div>

        <div className="mx-3 border-t-2 border-dashed border-ink/10" />

        <div className="p-3 pt-2">
          <p className="text-sm leading-relaxed text-ink/75">{t("walkInBody")}</p>
          {limitedSeats && <p className="mt-2 text-xs text-ink/60">{t("walkInSeats")}</p>}
        </div>
      </div>
    </div>
  );
}
