import { t } from "@/lib/i18n";

const HOST_URL = "https://www.kwanjaoei.com/";
/** The festival's dedicated Facebook page. */
const FACEBOOK_URL = "https://www.facebook.com/bkkcpbfest/";

const linkClasses =
  "text-ink underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2";

export default function SiteFooter() {
  return (
    <footer className="border-t-[3px] border-peach">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-sm text-ink/70 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="font-display text-base text-ink">
          {t("festivalName")} · {t("festivalYear")}
        </p>
        <p className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span>
            {t("hostedBy")}{" "}
            <a href={HOST_URL} target="_blank" rel="noopener noreferrer" className={linkClasses}>
              kwanjaoei.com
            </a>
          </span>
          <a href={FACEBOOK_URL} target="_blank" rel="noopener noreferrer" className={linkClasses}>
            {t("facebook")} ↗
          </a>
        </p>
      </div>
    </footer>
  );
}
