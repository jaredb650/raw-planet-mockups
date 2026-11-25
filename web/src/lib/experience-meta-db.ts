import "server-only";
import { like } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { experiences, settings } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/automation/settings";
import { resolveExperienceMeta, type ExperienceMeta } from "./experience-meta";

const PREFIX = "expMeta:";

export const experienceMetaKey = (experienceId: string) => `${PREFIX}${experienceId}`;

export async function getExperienceMeta(experienceId: string, slug: string): Promise<ExperienceMeta> {
  const stored = await getSetting<Partial<ExperienceMeta>>(experienceMetaKey(experienceId));
  return resolveExperienceMeta(slug, stored);
}

export async function getAllExperienceMeta(
  list: { id: string; slug: string }[],
): Promise<Map<string, ExperienceMeta>> {
  const db = await getDb();
  const rows = await db.select().from(settings).where(like(settings.key, `${PREFIX}%`));
  const byId = new Map<string, Partial<ExperienceMeta>>();
  for (const r of rows) {
    const id = r.key.slice(PREFIX.length);
    if (r.value && typeof r.value === "object") byId.set(id, r.value as Partial<ExperienceMeta>);
  }
  const out = new Map<string, ExperienceMeta>();
  for (const x of list) {
    out.set(x.id, resolveExperienceMeta(x.slug, byId.get(x.id)));
  }
  return out;
}

export async function saveExperienceMeta(experienceId: string, meta: ExperienceMeta): Promise<void> {
  await setSetting(experienceMetaKey(experienceId), { ...meta, customized: true });
}

/**
 * Returns the IDs of all experiences that expect a post-session deliverable
 * (track / mix / recording). Replaces the hardcoded `theme = 'production'` check.
 */
export async function getDeliverableExperienceIds(): Promise<string[]> {
  const db = await getDb();
  const exps = await db.select({ id: experiences.id, slug: experiences.slug }).from(experiences);
  const allMeta = await getAllExperienceMeta(exps);
  return exps.filter((x) => allMeta.get(x.id)?.hasDeliverable).map((x) => x.id);
}
