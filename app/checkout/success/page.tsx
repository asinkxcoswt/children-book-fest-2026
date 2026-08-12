import Link from "next/link";
import { t } from "@/lib/i18n";
import OrderStatus from "@/components/OrderStatus";
import SectionHeading from "@/components/SectionHeading";

/* Buyers land here from Stripe (or directly for free orders). The actual
 * confirmation comes from polling the platform, not from the redirect. */

/* noindex: the order id in the URL is the only thing guarding these tickets. */
export const metadata = {
  title: t("checkoutSuccessTitle"),
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{
    orderId?: string;
    token?: string;
  }>;
}

export default async function CheckoutSuccess({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-20">
      <SectionHeading as="h1" title={t("checkoutSuccessTitle")} caption={t("checkoutSuccessTitle", "en")} />
      <div className="mt-6">
        <OrderStatus orderId={params.orderId} token={params.token} />
      </div>
      <Link href="/" className="mt-10 inline-block text-sm text-tomato hover:underline">
        ← {t("backToHome")}
      </Link>
    </main>
  );
}
