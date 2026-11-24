import { eq } from "drizzle-orm";
import { TURNSTILE_FAILED, verifyTurnstile } from "@/lib/turnstile";
import { clientIp } from "@/app/api/_lib/http";
import { requestLang } from "@/lib/lang";
import { z } from "zod";
import { fail, json, limited, readBody, sameOrigin } from "@/components/site/server/api";
import { getDb } from "@/lib/db";
import { experiences, inquiries } from "@/lib/db/schema";
import { sendInquiryEmails } from "@/lib/email/notify";

const Body = z.object({
  kind: z.enum(["group", "private_event", "corporate", "general", "press"]).default("general"),
  name: z.string({ error: "Please add your name." }).trim().min(1, { error: "Please add your name." }).max(120),
  email: z.email({ error: "Please check your email address." }).trim().toLowerCase().max(200),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  experience: z.string().trim().max(80).optional(),
  preferredDate: z.string().trim().max(80).optional().transform((v) => v || null),
  groupSize: z
    .union([z.coerce.number().int().min(1, { error: "Group size should be at least 1." }).max(500), z.literal("")])
    .optional()
    .transform((v) => (typeof v === "number" ? v : null)),
  message: z.string({ error: "Please tell us a little about what you have in mind." }).trim().min(1, { error: "Please tell us a little about what you have in mind." }).max(4000),
  website: z.string().max(200).optional(), // honeypot
  turnstileToken: z.string().max(4096).optional().nullable(),
});

/** Contact form + group / private event requests. Stores an inquiry and emails host + guest. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return fail("Invalid request.", 403);
  if (limited(req, "inquiry", { capacity: 5, perMinute: 2 })) return fail("Too many messages. Please wait a minute and try again.", 429);
  const body = await readBody(req, Body);
  if (!body.ok) return body.res;
  const d = body.data;
  if (d.website) return json({ ok: true }, 201);
  if (!(await verifyTurnstile(d.turnstileToken, clientIp(req.headers)))) return fail(TURNSTILE_FAILED);

  const db = await getDb();
  let experienceId: string | null = null;
  if (d.experience) {
    const [e] = await db.select({ id: experiences.id }).from(experiences).where(eq(experiences.slug, d.experience)).limit(1);
    experienceId = e?.id ?? null;
  }
  const [row] = await db
    .insert(inquiries)
    .values({
      kind: d.kind,
      name: d.name,
      email: d.email,
      phone: d.phone,
      experienceId,
      preferredDate: d.preferredDate,
      groupSize: d.groupSize,
      message: d.message,
      language: requestLang(req),
    })
    .returning({ id: inquiries.id });

  try {
    await sendInquiryEmails(row.id);
  } catch (err) {
    console.error("[inquiry] email failed", err);
  }
  return json({ ok: true }, 201);
}
