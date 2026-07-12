import Link from "next/link";
import { t } from "@/lib/i18n";
import OrderStatus from "@/components/v4/OrderStatus";

/* Buyers land here from Stripe (or directly for free orders). The actual
 * confirmation comes from polling the platform, not from the redirect. */

export const metadata = { title: t("checkoutSuccessTitle") };

export default function CheckoutSuccess() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <h1 className="font-display text-4xl text-ink">{t("checkoutSuccessTitle")}</h1>
      <div className="mt-6">
        <OrderStatus />
      </div>
      <Link href="/v4" className="mt-10 inline-block text-sm text-tomato hover:underline">
        ← {t("backToHome")}
      </Link>
    </main>
  );
}
