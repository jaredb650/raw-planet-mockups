"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { giftCards } from "@/lib/db/schema";
import { adjustGiftCardBalance, issueGiftCard, voidGiftCard } from "@/lib/giftcards";
import { sendGiftCardEmails } from "@/lib/email/notify";
import { adminAction, bool, cents, str } from "@/lib/admin/action";
import { formatMoney } from "@/lib/money";
import type { ActionResult } from "@/components/admin/types";

const email = z.union([z.literal(""), z.email("That email doesn't look right")]);

export async function issueGiftCardAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const amount = cents(fd, "amount");
    if (amount < 100) throw new Error("Enter at least $1.");
    const v = z
      .object({
        purchaserName: z.string().min(1, "Who is it from?").max(120),
        purchaserEmail: email,
        recipientName: z.string().max(120),
        recipientEmail: email,
        message: z.string().max(1000),
      })
      .parse({
        purchaserName: str(fd, "purchaserName") || "Raw Planet",
        purchaserEmail: str(fd, "purchaserEmail"),
        recipientName: str(fd, "recipientName"),
        recipientEmail: str(fd, "recipientEmail"),
        message: str(fd, "message"),
      });
    const send = bool(fd, "sendEmail") && Boolean(v.recipientEmail || v.purchaserEmail);
    const card = await issueGiftCard({
      amountCents: amount,
      purchaserName: v.purchaserName,
      purchaserEmail: v.purchaserEmail || "hello@rawplanetexperiences.com",
      recipientName: v.recipientName || undefined,
      recipientEmail: v.recipientEmail || undefined,
      message: v.message || undefined,
      sendEmail: send,
    });
    const id = card.id;
    revalidatePath("/admin", "layout");
    redirect(`/admin/gift-cards/${id}?issued=1`);
  });
}

export async function adjustGiftCardAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const amount = cents(fd, "amount");
    const direction = str(fd, "direction") === "remove" ? -1 : 1;
    const note = str(fd, "note");
    if (!note) throw new Error("Add a short note so you remember why.");
    const card = await adjustGiftCardBalance(id, direction * amount, note);
    return `Balance is now ${formatMoney(card.balanceCents)}.`;
  });
}

export async function voidGiftCardAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    await voidGiftCard(z.string().min(1).parse(str(fd, "id")), str(fd, "reason"));
    return "Gift card voided. It can no longer be used.";
  });
}

export async function resendGiftCardAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const id = z.string().min(1).parse(str(fd, "id"));
    const db = await getDb();
    const [card] = await db.select().from(giftCards).where(eq(giftCards.id, id)).limit(1);
    if (!card) throw new Error("Gift card not found.");
    if (card.status !== "active") throw new Error("Only active gift cards can be re-sent.");
    const toRecipient = Boolean(card.recipientEmail);
    await sendGiftCardEmails(card.id, { purchaserReceipt: !toRecipient, recipient: toRecipient });
    await db.update(giftCards).set({ deliveredAt: new Date() }).where(eq(giftCards.id, id));
    return `Sent to ${card.recipientEmail ?? card.purchaserEmail}.`;
  });
}
