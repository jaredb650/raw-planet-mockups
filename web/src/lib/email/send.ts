/**
 * Low-level email sender. Uses Resend when RESEND_API_KEY is set; otherwise
 * the message is only recorded in email_log (viewable in Admin → Emails), so
 * nothing is ever silently lost in development.
 */
import "server-only";
import { Resend } from "resend";
import { getDb } from "@/lib/db";
import { emailLog } from "@/lib/db/schema";
import { BUSINESS, integrations } from "@/lib/config";

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  template: string;
  bookingId?: string | null;
  replyTo?: string;
  attachments?: { filename: string; content: string; contentType?: string }[];
};

let resend: Resend | null = null;

export async function sendEmail(msg: OutgoingEmail): Promise<{ ok: boolean; id?: string; error?: string }> {
  const db = await getDb();
  const from = process.env.EMAIL_FROM ?? `${BUSINESS.name} <bookings@rawplanetexperiences.com>`;
  if (!integrations.resend()) {
    await db.insert(emailLog).values({
      to: msg.to,
      subject: msg.subject,
      template: msg.template,
      bookingId: msg.bookingId ?? null,
      status: "logged",
      html: msg.html,
    });
    if (process.env.NODE_ENV !== "test") console.info(`[email:logged] ${msg.template} → ${msg.to}: ${msg.subject}`);
    return { ok: true };
  }
  try {
    resend ??= new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      replyTo: msg.replyTo ?? BUSINESS.contactEmail,
      attachments: msg.attachments?.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content).toString("base64"),
        contentType: a.contentType,
      })),
    });
    if (error) throw new Error(error.message);
    await db.insert(emailLog).values({
      to: msg.to,
      subject: msg.subject,
      template: msg.template,
      bookingId: msg.bookingId ?? null,
      status: "sent",
      providerId: data?.id ?? null,
      html: msg.html,
    });
    return { ok: true, id: data?.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error(`[email] ${msg.template} → ${msg.to} failed: ${error}`);
    await db.insert(emailLog).values({
      to: msg.to,
      subject: msg.subject,
      template: msg.template,
      bookingId: msg.bookingId ?? null,
      status: "failed",
      error,
      html: msg.html,
    });
    return { ok: false, error };
  }
}
