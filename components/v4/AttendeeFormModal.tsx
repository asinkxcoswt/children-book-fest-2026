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

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="af-title"
        className="w-full max-w-md rounded-3xl bg-paper p-6 shadow-xl"
      >
        <div className={`-mx-6 -mt-6 mb-5 rounded-t-3xl px-6 py-4 ${c.bg}`}>
          <h2 id="af-title" className={`font-display text-2xl ${c.on}`}>
            {t("attendeeDetails")}
          </h2>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {field("name", t("parentName"), "text", true, firstFieldRef)}
          {field("childName", t("childName"), "text", true)}
          {field("email", t("buyerEmail"), "email", true)}
          {field("phone", t("phoneOptional"), "tel", false)}

          {error && (
            <p className="text-sm text-tomato" role="alert">
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
            <button
              type="submit"
              disabled={!valid || submitting}
              className={`flex-1 rounded-full px-5 py-2.5 ${c.bg} ${c.on} transition-opacity disabled:opacity-40`}
            >
              {submitting ? t("processingOrder") : t("confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
