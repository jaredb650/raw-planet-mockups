/**
 * Picks site imagery per experience theme from the media manifest.
 * DB `experience.media` wins when the admin has set it; otherwise we use the
 * curated manifest order below.
 */
import { djPhotos, hostPhotos, meditationStills, productionPhotos, videos, type MediaItem, type VideoItem } from "@/content/media";
import type { PublicExperience } from "@/lib/queries/public";
import type { Theme } from "./format";

export type Photo = { src: string; alt: string; width: number; height: number };

const bySrc = (list: MediaItem[], names: string[]): MediaItem[] => {
  const picked = names.map((n) => list.find((m) => m.src.endsWith(`/${n}.jpg`))).filter((m): m is MediaItem => Boolean(m));
  const rest = list.filter((m) => !picked.includes(m));
  return [...picked, ...rest];
};

/** Photos that clearly show the production sessions first; ambiguous mood shots last. */
const PRODUCTION = bySrc(
  productionPhotos.filter((p) => !p.tags.includes("purple") && !p.src.includes("prod-19")),
  ["prod-02", "prod-13", "prod-05", "prod-15", "prod-14", "prod-17", "prod-20", "prod-06", "prod-04", "prod-07", "prod-08", "prod-09"],
);
const DJ = bySrc(djPhotos, ["dj-01", "dj-04", "dj-06", "dj-03", "dj-12", "dj-08", "dj-14", "dj-10", "dj-15", "dj-05", "dj-07", "dj-11", "dj-13"]);
const WELLNESS = meditationStills;

const pick = (src: string) => [...productionPhotos, ...djPhotos, ...hostPhotos, ...meditationStills].find((m) => m.src === src)!;

export const SITE_MEDIA = {
  heroMain: pick("/media/dj/dj-01.jpg"),
  heroSnap: pick("/media/production/prod-05.jpg"),
  host: pick("/media/production/prod-07.jpg"),
  hostAlt: pick("/media/dj/dj-09.jpg"),
  hostPortrait: hostPhotos.find((h) => h.tags.includes("dark")) ?? hostPhotos[0],
  groups: pick("/media/dj/dj-03.jpg"),
  community: pick("/media/production/prod-09.jpg"),
};

export function photosFor(e: Pick<PublicExperience, "theme" | "media">): Photo[] {
  if (e.media.length) {
    return e.media.map((m) => ({ src: m.src, alt: m.alt, width: m.width ?? 1600, height: m.height ?? 1067 }));
  }
  const theme = e.theme as Theme;
  return theme === "dj" ? DJ : theme === "wellness" ? WELLNESS : PRODUCTION;
}

/** The image used on the alternating home rows and cards. */
export function cardPhotoFor(theme: Theme): Photo {
  if (theme === "dj") return pick("/media/dj/dj-04.jpg");
  if (theme === "wellness") return meditationStills[0];
  return pick("/media/production/prod-13.jpg");
}

export function loopFor(theme: Theme): VideoItem | undefined {
  return videos.find((v) => v.loop && v.tags.includes(theme === "wellness" ? "meditation" : theme));
}

export function reelFor(theme: Theme): VideoItem | undefined {
  return videos.find((v) => !v.loop && v.tags.includes(theme === "wellness" ? "meditation" : theme));
}

export const meditationReel = videos.find((v) => v.src === "/media/video/meditation.mp4");
export const productionReel = videos.find((v) => v.src === "/media/video/production.mp4");
