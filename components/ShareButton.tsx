"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";

/** Share control for event pages. On devices with the Web Share API it opens
 *  the native share sheet (LINE, Messenger, … for free); elsewhere it shows a
 *  small popover with copy-link and LINE/Facebook share URLs — no SDKs. */
export default function ShareButton({ title, text }: { title: string; text: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onAway = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onAway);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onAway);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User dismissed the sheet — nothing to do.
      }
      return;
    }
    setOpen((o) => !o);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — leave the popover open so links still work.
    }
  }

  const shareUrl = () => encodeURIComponent(window.location.href);
  const itemClasses =
    "block w-full cursor-pointer rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={share}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex cursor-pointer items-center gap-2 rounded-full border-2 border-ink/10 bg-paper px-3 py-1 text-sm text-ink transition-colors hover:border-ink/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2"
      >
        <span aria-hidden>↗</span>
        {t("share")}
      </button>

      {open && (
        <div
          role="menu"
          aria-label={t("shareVia")}
          className="absolute left-0 top-full z-10 mt-2 w-44 rounded-xl border-2 border-ink/10 bg-paper p-1.5 shadow-lg"
        >
          <button type="button" role="menuitem" onClick={copyLink} className={itemClasses}>
            {copied ? t("copied") : t("copyLink")}
          </button>
          <a
            role="menuitem"
            href={`https://social-plugins.line.me/lineit/share?url=${shareUrl()}`}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClasses}
          >
            {t("lineApp")} ↗
          </a>
          <a
            role="menuitem"
            href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl()}`}
            target="_blank"
            rel="noopener noreferrer"
            className={itemClasses}
          >
            {t("facebook")} ↗
          </a>
        </div>
      )}
    </div>
  );
}
