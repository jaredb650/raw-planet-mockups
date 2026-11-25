"use server";

import { z } from "zod";
import { setSetting } from "@/lib/automation/settings";
import { runJobs } from "@/lib/automation/jobs";
import { adminAction, bool, str } from "@/lib/admin/action";
import { POSTAL_ADDRESS_MISSING } from "@/lib/admin/campaigns";
import { parsePhone } from "@/lib/phone";
import type { ActionResult } from "@/components/admin/types";

export async function saveContactAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const hostPhone = parsePhone(str(fd, "hostPhone"), "Phone");
    const hostWhatsapp = parsePhone(str(fd, "hostWhatsapp"), "WhatsApp");
    await setSetting("hostPhone", hostPhone);
    await setSetting("hostWhatsapp", hostWhatsapp);
    return "Saved. New emails will show these numbers.";
  });
}

export async function saveMarketingAction(_p: ActionResult, fd: FormData): Promise<ActionResult> {
  return adminAction(async () => {
    const address = z.string().max(300, "That address is too long").parse(str(fd, "postalAddress")).trim();
    const winBack = bool(fd, "winBackEnabled");
    if (winBack && !address) throw new Error(POSTAL_ADDRESS_MISSING);
    await setSetting("postalAddress", address);
    await setSetting("winBackEnabled", winBack);
    return "Saved.";
  });
}

export async function runAutomationsAction(): Promise<ActionResult> {
  return adminAction(async () => {
    const r = await runJobs();
    if (r.locked) return "Automations are already running. Try again in a minute.";
    const sent = r.jobs.reduce((n, j) => n + j.sent, 0);
    const failed = r.jobs.filter((j) => !j.ok);
    if (failed.length) throw new Error(`Ran, but ${failed.map((j) => `${j.job}${j.error ? ` (${j.error})` : ""}`).join(", ")} failed.`);
    return `Done in ${(r.ms / 1000).toFixed(1)}s. ${sent} email${sent === 1 ? "" : "s"} sent.`;
  });
}
