"use client";

import { useEffect, useRef, useState } from "react";
import type { ColorToken } from "@/types/content";
import { tokenClasses } from "@/lib/colors";
import { t } from "@/lib/i18n";

export interface AttendeeForm {
  /** Parent / buyer full name. */
  name: string;
  childName: string;
  email: string;
  phone: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Confirmation dialog collecting attendee details before the order is created.
 *  `onConfirm` resolves to an error message to display, or null on success
 *  (the caller then redirects, so the modal just stays in its busy state). */
export default function AttendeeFormModal({
  color,
  submitting,
  onConfirm,
  onClose,
}: {
  color: ColorToken;
  submitting: boolean;
  onConfirm: (form: AttendeeForm) => Promise<string | null>;
  onClose: () => void;
}) {
  const c = tokenClasses(color);
  const [form, setForm] = useState<AttendeeForm>({ name: "", childName: "", email: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus the first field once on open — NOT keyed on props, or any parent
  // re-render (e.g. the submitting flip) would steal focus back here.
  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // Focus trap: keep Tab cycling inside the dialog.
      if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          "input, button:not(:disabled)",
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const valid =
    form.name.trim().length > 0 &&
    form.childName.trim().length > 0 &&
    EMAIL_RE.test(form.email.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setError(null);
    const message = await onConfirm(form);
    if (message) setError(message);
  }

  const field = (
    key: keyof AttendeeForm,
    label: string,
    type: string,
    required: boolean,
    autoComplete: string,
    ref?: React.Ref<HTMLInputElement>,
  ) => (
    <div>
      <label htmlFor={`af-${key}`} className="block text-sm text-ink/70">
        {label}
      </label>
      <input
        ref={ref}
        id={`af-${key}`}
        type={type}
        required={required}
        autoComplete={autoComplete}
        aria-describedby={error ? "af-error" : undefined}
        readOnly={submitting}
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        className="mt-1 w-full rounded-xl border-2 border-ink/15 bg-paper px-3 py-2 text-base focus:border-ink/40 focus:outline-none"
      />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="af-title"
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-paper p-6 pl-8 shadow-xl"
      >
        {/* Ticket-stub spine, echoing the purchase cards. */}
        <span aria-hidden className={`absolute inset-y-0 left-0 w-3 ${c.bg}`} />
        <h2 id="af-title" className="font-display text-2xl text-ink">
          {t("attendeeDetails")}
        </h2>
        <div className="mb-5 mt-3 border-t-2 border-dashed border-ink/10" />

        <form onSubmit={submit} aria-busy={submitting} className="space-y-4">
          {field("name", t("parentName"), "text", true, "name", firstFieldRef)}
          {field("childName", t("childName"), "text", true, "off")}
          {field("email", t("buyerEmail"), "email", true, "email")}
          {field("phone", t("phoneOptional"), "tel", false, "tel")}

          {error && (
            <p id="af-error" className="text-sm text-tomato" role="alert">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-full border-2 border-ink/15 px-5 py-2.5 text-ink/70 transition-colors hover:border-ink/40 disabled:opacity-40"
            >
              {t("cancel")}
            </button>
            {/* While submitting the button stays enabled (submit() guards
                re-entry) so it keeps focus — disabling would drop focus and
                read as a dead control mid-loading. */}
            <button
              type="submit"
              disabled={!valid}
              aria-disabled={!valid || submitting}
              className={`flex-1 rounded-full px-5 py-2.5 ${c.bg} ${c.on} transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 disabled:opacity-40 ${
                submitting ? "cursor-wait opacity-70" : ""
              }`}
            >
              {submitting && (
                <span
                  aria-hidden
                  className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent align-[-2px]"
                />
              )}
              {submitting ? t("processingOrder") : t("confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
