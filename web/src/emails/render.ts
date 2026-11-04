/** Render a template's React element to email-ready HTML + plain text. */
import { render } from "@react-email/render";
import type { EmailOutput } from "./types";

export type RenderedEmail = { subject: string; html: string; text: string };

export async function renderEmail(out: EmailOutput): Promise<RenderedEmail> {
  const [html, text] = await Promise.all([render(out.element), render(out.element, { plainText: true })]);
  return { subject: out.subject, html, text };
}
