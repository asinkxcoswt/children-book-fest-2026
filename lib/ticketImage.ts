/* Browser-only: draws an issued ticket to a PNG blob (canvas + QR).
 * Colors and fonts are read from the CSS design tokens at draw time —
 * the token layer in globals.css stays the single source of truth. */

import QRCode from "qrcode";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";

export interface TicketDisplay {
  /** Human-friendly ticket number (TK-XXXX-XXXX): encoded in the QR and printed
   *  on the stub as the manual-entry fallback for gate staff. */
  ticketNo: string;
  principal: string;
  eventTitle: string;
  dateDisplay: string;
  venue: string;
  festivalName: string;
  color: ColorToken;
}

/* Rendered size (CSS px); canvas draws at 2x for crisp gallery saves. */
export const TICKET_W = 640;
export const TICKET_H = 900;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Canvas draws with a system fallback for any face it does not consider loaded,
 *  while still centring on the *requested* face's metrics — Thai then paints
 *  wider than the box it was positioned in and drifts off-centre. iOS Safari hits
 *  this constantly: document.fonts.ready only settles pending loads, and a
 *  subsetted Thai face nothing has painted yet was never pending. Asking for the
 *  exact size/family *and* the glyphs is what actually pulls the subset in. */
async function loadFonts(specs: string[], text: string): Promise<void> {
  await Promise.all(specs.map((spec) => document.fonts.load(spec, text).catch(() => [])));
  await document.fonts.ready;
}

/** Sets the largest font size at or below `size` that keeps `text` within
 *  `maxWidth` — a wider-than-expected face shrinks instead of running off the card. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  /** Full family list, fallback included — e.g. `${displayFont}, monospace`. */
  family: string,
): void {
  let px = size;
  ctx.font = `${px}px ${family}`;
  while (px > 12 && ctx.measureText(text).width > maxWidth) {
    px -= 1;
    ctx.font = `${px}px ${family}`;
  }
}

/** Wraps text for canvas. Thai has no spaces, so fall back to per-character wrapping. */
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const units = text.includes(" ") ? text.split(" ") : [...text];
  const glue = text.includes(" ") ? " " : "";
  const lines: string[] = [];
  let line = "";
  for (const unit of units) {
    const candidate = line ? line + glue + unit : unit;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = unit;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function drawTicket(ticket: TicketDisplay): Promise<Blob> {
  const paper = cssVar("--color-paper");
  const ink = cssVar("--color-ink");
  const accent = cssVar(`--color-${ticket.color}`);
  const onAccent = tokenClasses(ticket.color).on === "text-ink" ? ink : paper;
  const displayFont = cssVar("--font-itim");
  const bodyFont = cssVar("--font-plex-thai");
  const W = TICKET_W;
  const H = TICKET_H;

  await loadFonts(
    [
      `18px ${bodyFont}`,
      `20px ${bodyFont}`,
      `28px ${displayFont}`,
      `34px ${displayFont}`,
      `40px ${displayFont}`,
    ],
    ticket.festivalName +
      ticket.eventTitle +
      ticket.principal +
      ticket.dateDisplay +
      ticket.venue +
      ticket.ticketNo,
  );

  const canvas = document.createElement("canvas");
  canvas.width = W * 2;
  canvas.height = H * 2;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(2, 2);

  // Card base.
  ctx.fillStyle = paper;
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 32);
  ctx.fill();

  // Header band.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, W, H, 32);
  ctx.clip();
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 218);
  ctx.restore();

  ctx.fillStyle = onAccent;
  ctx.font = `18px ${bodyFont}, sans-serif`;
  ctx.fillText(ticket.festivalName, 40, 56);
  ctx.font = `40px ${displayFont}, sans-serif`;
  const titleLines = wrapText(ctx, ticket.eventTitle, W - 80).slice(0, 2);
  titleLines.forEach((line, i) => ctx.fillText(line, 40, 118 + i * 52));

  // QR block with quiet border.
  const qrSize = 330;
  const qrX = (W - qrSize) / 2;
  const qrY = 268;
  const qrDataUrl = await QRCode.toDataURL(ticket.ticketNo, {
    width: qrSize * 2,
    margin: 1,
    color: { dark: ink, light: paper },
  });
  const qrImg = new Image();
  await new Promise<void>((resolve, reject) => {
    qrImg.onload = () => resolve();
    qrImg.onerror = () => reject(new Error("qr render failed"));
    qrImg.src = qrDataUrl;
  });
  ctx.strokeStyle = accent;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(qrX - 18, qrY - 18, qrSize + 36, qrSize + 36, 24);
  ctx.stroke();
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Attendee + schedule.
  const textMax = W - 80;
  ctx.fillStyle = ink;
  ctx.textAlign = "center";
  fitFont(ctx, ticket.principal, textMax, 34, `${displayFont}, sans-serif`);
  ctx.fillText(ticket.principal, W / 2, qrY + qrSize + 74);
  fitFont(ctx, ticket.dateDisplay, textMax, 20, `${bodyFont}, sans-serif`);
  ctx.fillText(ticket.dateDisplay, W / 2, qrY + qrSize + 114);
  fitFont(ctx, ticket.venue, textMax, 20, `${bodyFont}, sans-serif`);
  ctx.fillText(ticket.venue, W / 2, qrY + qrSize + 146);

  // Perforation + ticket id stub.
  const perfY = H - 92;
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.setLineDash([2, 10]);
  ctx.beginPath();
  ctx.moveTo(32, perfY);
  ctx.lineTo(W - 32, perfY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.fillStyle = ink;
  fitFont(ctx, ticket.ticketNo, textMax, 28, `${displayFont}, monospace`);
  ctx.fillText(ticket.ticketNo, W / 2, perfY + 56);
  ctx.textAlign = "start";

  // A blob, not a data URL: the PNG is a couple of megabytes, and the caller
  // needs File objects for the share sheet — base64 in between only adds a
  // decode step that can fail.
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("ticket render failed"))),
      "image/png",
    );
  });
}
