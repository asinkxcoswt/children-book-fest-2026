import { t, type Locale } from "@/lib/i18n";

/** Links out to the external registration system. We never collect registration
 *  data in-app, so this is always an external anchor with safe rel. */
export default function RegisterCta({
  url,
  className = "",
  locale,
}: {
  url: string;
  className?: string;
  locale?: Locale;
}) {
  return (
    <div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded-full px-7 py-3 text-lg ${className}`}
      >
        {t("register", locale)}
        <span aria-hidden>↗</span>
      </a>
      <p className="mt-2 text-xs text-ink/55">{t("registerExternalNote", locale)}</p>
    </div>
  );
}
