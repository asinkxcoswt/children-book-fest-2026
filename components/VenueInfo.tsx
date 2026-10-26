import { getVenue } from "@/lib/content";
import { formatDate } from "@/lib/i18n";
import { t } from "@/lib/i18n";

const linkClasses =
  "inline-flex items-center gap-1 rounded-md text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

/** The practical "where and when can I come" card on the home page: venue and
 *  address with a map link, the free exhibition's daily hours, and the days
 *  the building is shut. Three facts side by side on wide screens, stacked on
 *  phones. All content comes from content/venue.json. */
export default function VenueInfo() {
  const venue = getVenue();
  return (
    <dl className="grid gap-6 rounded-3xl border-2 border-ink/10 bg-paper p-6 sm:grid-cols-3 sm:gap-8 sm:p-8">
      <div className="border-l-4 border-sky pl-4">
        <dt className="font-display text-ink/60">{t("venue")}</dt>
        <dd className="mt-1 font-display text-2xl text-ink">{venue.fullName}</dd>
        <dd className="text-sm leading-relaxed text-ink">{venue.fullNameEn}</dd>
        <dd className="mt-1 text-sm leading-relaxed text-ink/75">{venue.address}</dd>
        <dd className="mt-2 text-sm">
          <a href={venue.mapUrl} target="_blank" rel="noopener noreferrer" className={linkClasses}>
            {t("openMap")} ↗
          </a>
        </dd>
      </div>
      <div className="border-l-4 border-meadow pl-4">
        <dt className="font-display text-ink/60">{t("exhibitionHours")}</dt>
        <dd className="mt-1 font-display text-2xl tabular-nums text-ink">
          {venue.exhibition.open}–{venue.exhibition.close}
        </dd>
        {/* "Every day" of the festival run, so the hours never read as the
            building's year-round hours. The run is the hero's editorial dates. */}
        <dd className="mt-1 text-sm leading-relaxed text-ink">
          {t("daily")} {t("festivalDates")}
        </dd>
        <dd className="text-sm leading-relaxed text-ink/75">{venue.exhibition.area}</dd>
      </div>
      <div className="border-l-4 border-tomato pl-4">
        <dt className="font-display text-ink/60">{t("closedDays")}</dt>
        {venue.closedDates.map((date) => (
          <dd key={date} className="mt-1 flex items-center gap-2 text-ink">
            <span className="rounded-full bg-tomato/10 px-2 py-0.5 font-display text-xs text-tomato">
              {t("closed")}
            </span>
            {formatDate(date)}
          </dd>
        ))}
      </div>
    </dl>
  );
}
