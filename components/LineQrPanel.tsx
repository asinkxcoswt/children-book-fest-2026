"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cssVar } from "@/lib/colors";
import { t } from "@/lib/i18n";

/** Desktop route into the chat purchase. The deep link is useless on a machine
 *  without LINE installed, and the buyer's tickets are meant to land on the
 *  phone they'll carry to the gate — so the QR moves the purchase to that phone
 *  from the start, rather than opening a desktop app whose chat history the
 *  buyer may never look at again.
 *
 *  Kept as a panel rather than a dialog: the desktop sidebar has the room, and
 *  the buyer has already pressed once by choosing quantities. */
export default function LineQrPanel({ lineUrl }: { lineUrl: string | null }) {
  /** Held with the URL it encodes, so a code for a previous basket can never be
   *  rendered against a newer selection — the check is at render, not a clear
   *  in the effect body. */
  const [qr, setQr] = useState<{ url: string; dataUrl: string } | null>(null);

  useEffect(() => {
    if (!lineUrl) return;
    let alive = true;
    // Black-on-white regardless of the event's colour: scanners want maximum
    // contrast, and these are the palette's own ink/paper.
    QRCode.toDataURL(lineUrl, {
      width: 320,
      margin: 1,
      color: { dark: cssVar("--color-ink"), light: cssVar("--color-paper") },
    })
      .then((dataUrl) => {
        if (alive) setQr({ url: lineUrl, dataUrl });
      })
      .catch(() => {
        // Non-fatal: the desktop-app link below still works.
      });
    return () => {
      alive = false;
    };
  }, [lineUrl]);

  const current = qr && qr.url === lineUrl ? qr.dataUrl : null;

  return (
    <div className="mt-4 rounded-2xl border-2 border-ink/10 p-4 text-center">
      <p className="font-display text-base text-ink">{t("scanToBuyWithLine")}</p>
      <div className="mt-3 flex justify-center">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL, not an optimizable asset
          <img
            src={current}
            alt={t("lineQrAlt")}
            width={160}
            height={160}
            className="h-40 w-40 rounded-lg"
          />
        ) : (
          <div aria-hidden className="h-40 w-40 animate-pulse rounded-lg bg-ink/10" />
        )}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-ink/60">{t("scanWithPhoneHint")}</p>
      {/* For the minority who do run LINE on this machine — quiet, because the
          phone is still the better destination for the tickets. */}
      {lineUrl && (
        <a
          href={lineUrl}
          className="mt-2 inline-block text-xs text-ink/60 underline underline-offset-2 hover:text-ink"
        >
          {t("openLineOnThisDevice")}
        </a>
      )}
    </div>
  );
}
