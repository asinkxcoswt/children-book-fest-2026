"use client";

import { useEffect, useRef, useState } from "react";
import type { ColorToken } from "@/types/content";
import type { PurchaseFormField } from "@/lib/ticketApi";
import { tokenClasses } from "@/lib/colors";
import { t, DEFAULT_LOCALE } from "@/lib/i18n";

/** Answers keyed by the organizer's field keys. */
export type PurchaseAnswers = Record<string, string>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Record<string, string | undefined>;

function labelOf(field: PurchaseFormField): string {
  return DEFAULT_LOCALE === "th" ? field.labelTh : field.labelEn;
}

/** Browsers autofill by field purpose, and the organizer's key is the only clue
 *  we have. Anything unrecognised opts out rather than guessing wrong — a LINE
 *  ID autofilled as a phone number is worse than no autofill. */
function autoCompleteOf(field: PurchaseFormField): string {
  if (field.type === "email") return "email";
  if (field.type === "tel") return "tel";
  if (field.key === "principal" || field.key === "name") return "name";
  return "off";
}

/** Confirmation dialog for the card path, rendering exactly the questions the
 *  organizer configured — the platform owns the field list, we only draw it.
 *  `onConfirm` resolves to an error message to display, or null on success
 *  (the caller then redirects, so the modal just stays in its busy state). */
export default function AttendeeFormModal({
  color,
  fields,
  submitting,
  onConfirm,
  onClose,
}: {
  color: ColorToken;
  fields: PurchaseFormField[];
  submitting: boolean;
  onConfirm: (answers: PurchaseAnswers) => Promise<string | null>;
  onClose: () => void;
}) {
  const c = tokenClasses(color);
  const [answers, setAnswers] = useState<PurchaseAnswers>(() =>
    Object.fromEntries(fields.map((f) => [f.key, ""])),
  );
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const firstFieldRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
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
          "input, select, button:not(:disabled)",
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

  /** Per-field messages, driven by the organizer's own `required` flags. */
  function validate(current: PurchaseAnswers): FieldErrors {
    const found: FieldErrors = {};
    for (const f of fields) {
      const value = (current[f.key] ?? "").trim();
      if (!value) {
        if (f.required) found[f.key] = t("errRequired");
        continue; // optional and blank is fine
      }
      if (f.type === "email" && !EMAIL_RE.test(value)) found[f.key] = t("errEmail");
    }
    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    // Never block on a disabled button — say what's wrong and focus it instead.
    const found = validate(answers);
    setFieldErrors(found);
    const firstBad = fields.find((f) => found[f.key])?.key;
    if (firstBad) {
      setError(t("errFixFields"));
      document.getElementById(`af-${firstBad}`)?.focus();
      return;
    }
    setError(null);
    const message = await onConfirm(answers);
    if (message) setError(message);
  }

  function update(key: string, value: string) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  }

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

        {/* noValidate: our bilingual messages replace the browser's own bubbles. */}
        <form onSubmit={submit} noValidate aria-busy={submitting} className="space-y-4">
          {fields.map((f, i) => {
            const fieldError = fieldErrors[f.key];
            const describedBy = fieldError ? `af-${f.key}-error` : undefined;
            const shared = {
              id: `af-${f.key}`,
              "aria-invalid": fieldError ? true : undefined,
              "aria-describedby": describedBy,
              value: answers[f.key] ?? "",
              className: `mt-1 w-full rounded-xl border-2 bg-paper px-3 py-2 text-base focus:outline-none ${
                fieldError ? "border-tomato focus:border-tomato" : "border-ink/15 focus:border-ink/40"
              }`,
            };
            return (
              <div key={f.key}>
                <label htmlFor={`af-${f.key}`} className="block text-sm text-ink/70">
                  {labelOf(f)}
                </label>
                {f.type === "select" ? (
                  <select
                    {...shared}
                    ref={i === 0 ? (firstFieldRef as React.Ref<HTMLSelectElement>) : undefined}
                    disabled={submitting}
                    onChange={(e) => update(f.key, e.target.value)}
                  >
                    <option value="">—</option>
                    {(f.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    {...shared}
                    ref={i === 0 ? (firstFieldRef as React.Ref<HTMLInputElement>) : undefined}
                    type={f.type}
                    autoComplete={autoCompleteOf(f)}
                    readOnly={submitting}
                    onChange={(e) => update(f.key, e.target.value)}
                    onBlur={() => {
                      const message = validate(answers)[f.key];
                      if (message) setFieldErrors((prev) => ({ ...prev, [f.key]: message }));
                    }}
                  />
                )}
                {fieldError && (
                  <p id={`af-${f.key}-error`} className="mt-1 text-xs text-tomato">
                    {fieldError}
                  </p>
                )}
              </div>
            );
          })}

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
            {/* Always enabled: an incomplete form gets an explanation on submit,
                not a dead control. submit() guards re-entry while busy. */}
            <button
              type="submit"
              aria-disabled={submitting}
              className={`flex-1 rounded-full px-5 py-2.5 ${c.bg} ${c.on} transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 ${
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
