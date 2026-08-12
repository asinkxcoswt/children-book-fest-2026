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
  /** Free-form: phone, LINE ID, Facebook — whatever the buyer prefers. */
  contact: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = Partial<Record<keyof AttendeeForm, string>>;

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
  const [form, setForm] = useState<AttendeeForm>({ name: "", childName: "", email: "", contact: "" });
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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

  /** Per-field messages. Every field is required; email also needs a shape. */
  function validate(f: AttendeeForm): FieldErrors {
    const found: FieldErrors = {};
    if (!f.name.trim()) found.name = t("errRequired");
    if (!f.childName.trim()) found.childName = t("errRequired");
    if (!f.email.trim()) found.email = t("errRequired");
    else if (!EMAIL_RE.test(f.email.trim())) found.email = t("errEmail");
    if (!f.contact.trim()) found.contact = t("errRequired");
    return found;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    // Never block on a disabled button — say what's wrong and focus it instead.
    const found = validate(form);
    setFieldErrors(found);
    const firstBad = (Object.keys(found) as (keyof AttendeeForm)[])[0];
    if (firstBad) {
      setError(t("errFixFields"));
      document.getElementById(`af-${firstBad}`)?.focus();
      return;
    }
    setError(null);
    const message = await onConfirm(form);
    if (message) setError(message);
  }

  const field = ({
    key,
    label,
    type,
    autoComplete,
    ref,
    hint,
  }: {
    key: keyof AttendeeForm;
    label: string;
    type: string;
    autoComplete: string;
    ref?: React.Ref<HTMLInputElement>;
    hint?: string;
  }) => {
    const fieldError = fieldErrors[key];
    return (
      <div>
        <label htmlFor={`af-${key}`} className="block text-sm text-ink/70">
          {label}
        </label>
        {hint && (
          <p id={`af-${key}-hint`} className="mt-0.5 text-xs text-ink/60">
            {hint}
          </p>
        )}
        <input
          ref={ref}
          id={`af-${key}`}
          type={type}
          required
          autoComplete={autoComplete}
          aria-invalid={fieldError ? true : undefined}
          aria-describedby={
            [hint ? `af-${key}-hint` : null, fieldError ? `af-${key}-error` : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          readOnly={submitting}
          value={form[key]}
          // Clear this field's message as soon as the buyer starts fixing it.
          onChange={(e) => {
            const { value } = e.target;
            setForm((f) => ({ ...f, [key]: value }));
            setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
          }}
          onBlur={() => {
            const message = validate(form)[key];
            if (message) setFieldErrors((prev) => ({ ...prev, [key]: message }));
          }}
          className={`mt-1 w-full rounded-xl border-2 bg-paper px-3 py-2 text-base focus:outline-none ${
            fieldError ? "border-tomato focus:border-tomato" : "border-ink/15 focus:border-ink/40"
          }`}
        />
        {fieldError && (
          <p id={`af-${key}-error`} className="mt-1 text-xs text-tomato">
            {fieldError}
          </p>
        )}
      </div>
    );
  };

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
          {field({ key: "name", label: t("parentName"), type: "text", autoComplete: "name", ref: firstFieldRef })}
          {field({ key: "childName", label: t("childName"), type: "text", autoComplete: "off" })}
          {field({ key: "email", label: t("buyerEmail"), type: "email", autoComplete: "email" })}
          {/* Free-form, so no `tel` type/autofill — a LINE ID is not a phone number. */}
          {field({
            key: "contact",
            label: t("contact"),
            type: "text",
            autoComplete: "off",
            hint: t("contactHint"),
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
