"use server";

/**
 * Test-mode "payment" for local dev and e2e, used only while STRIPE_SECRET_KEY
 * is unset. Mirrors what the Stripe webhook does on a paid Checkout Session.
 */
import { redirect } from "next/navigation";
import { integrations } from "@/lib/config";
import { expireBooking, fulfillBooking, getBooking, getBookingForCustomer } from "@/lib/booking/service";
import { expireGiftCardPurchase, fulfillGiftCard, getGiftCard, giftCardSuccessPath, verifyGiftCardLinkToken } from "@/lib/giftcards";

function guard() {
  if (!integrations.testCheckout()) throw new Error("Test checkout is disabled.");
}

export async function payTestBooking(form: FormData): Promise<void> {
  guard();
  const id = String(form.get("id") ?? "");
  const token = String(form.get("t") ?? "");
  const pre = await getBooking(id);
  const b = pre ? await getBookingForCustomer(pre.code, token) : undefined;
  if (!b) redirect("/book");
  // Only an open hold can be paid; anything else just shows its current state.
  if (b.status === "pending_payment" || b.status === "expired") {
    await fulfillBooking(b.id, {
      amountPaidCents: b.totalCents,
      paymentIntentId: b.totalCents > 0 ? `pi_test_${b.id}` : null,
      checkoutSessionId: `cs_test_${b.id}`,
    });
  }
  redirect(`/booking/${b.code}?t=${b.manageToken}`);
}

export async function cancelTestBooking(form: FormData): Promise<void> {
  guard();
  const id = String(form.get("id") ?? "");
  const token = String(form.get("t") ?? "");
  const pre = await getBooking(id);
  const b = pre ? await getBookingForCustomer(pre.code, token) : undefined;
  if (!b) redirect("/book");
  if (b.status === "pending_payment") await expireBooking(b.id, "Guest left checkout without paying");
  const slug = String(form.get("slug") ?? "");
  redirect(slug ? `/book/${encodeURIComponent(slug)}?cancelled=${b.code}&t=${b.manageToken}` : "/book");
}

export async function payTestGiftCard(form: FormData): Promise<void> {
  guard();
  const id = String(form.get("id") ?? "");
  const card = verifyGiftCardLinkToken(id, String(form.get("t") ?? "")) ? await getGiftCard(id) : undefined;
  if (!card) redirect("/gift-cards");
  if (card.status === "pending_payment") {
    await fulfillGiftCard(card.id, { amountPaidCents: card.initialCents, paymentIntentId: `pi_test_${card.id}`, checkoutSessionId: `cs_test_${card.id}` });
  }
  redirect(giftCardSuccessPath(card.id));
}

export async function cancelTestGiftCard(form: FormData): Promise<void> {
  guard();
  const id = String(form.get("id") ?? "");
  if (verifyGiftCardLinkToken(id, String(form.get("t") ?? ""))) await expireGiftCardPurchase(id);
  redirect("/gift-cards?cancelled=1");
}
