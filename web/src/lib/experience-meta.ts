import { videos as studioVideos } from "@/content/media";
import { HOST, hostsLine, PERFECT_FOR, PRIVATE_SESSION_CENTS, SESSION_FLOW_TITLE } from "@/content/site";

export type ExperienceVideo = {
  src: string;
  alt: string;
  poster?: string;
  caption?: string;
  aspect?: "portrait" | "landscape";
};

export type ExperienceFaqItem = {
  q: string;
  a: string;
};

export type ExperienceMeta = {
  videos: ExperienceVideo[];
  hostsLabel: string;
  privateRateCents: number | null;
  hasDeliverable: boolean;
  takeHome: string;
  perfectFor: string[];
  flowTitle: string;
  faqs: ExperienceFaqItem[];
  customized?: boolean;
};

export const ORIGINAL_EXPERIENCE_SLUGS = ["music-production", "dj-session", "sound-meditation"] as const;

export function isOriginalExperienceSlug(slug: string): boolean {
  return (ORIGINAL_EXPERIENCE_SLUGS as readonly string[]).includes(slug);
}

const TAKE_HOME_DEFAULTS: Record<string, string> = {
  "music-production": "A bounced audio file of your music, plus pictures",
  "dj-session": "A recording of the mix you create",
  "sound-meditation": "The full meditation recording and original compositions",
};

function studioVideosForTag(tag: string): ExperienceVideo[] {
  return studioVideos
    .filter((v) => !v.loop && v.tags.includes(tag))
    .map((v) => ({
      src: v.src,
      alt: v.alt,
      poster: v.poster,
      caption: v.caption,
      aspect: v.width > v.height ? "landscape" : "portrait",
    }));
}

/**
 * Per-experience defaults. Only the 3 original flagship slugs inherit the
 * legacy studio copy/videos/co-hosts/deliverable flag — newly created
 * experiences start clean and never accidentally inherit another session's
 * hosts, videos, pricing, or track-delivery queue.
 */
export function defaultMetaForSlug(slug: string): ExperienceMeta {
  if (slug === "music-production") {
    return {
      videos: studioVideosForTag("production"),
      hostsLabel: hostsLine("production"),
      privateRateCents: PRIVATE_SESSION_CENTS.production ?? 65000,
      hasDeliverable: true,
      takeHome: TAKE_HOME_DEFAULTS["music-production"],
      perfectFor: [...(PERFECT_FOR.production ?? [])],
      flowTitle: SESSION_FLOW_TITLE.production ?? "How the session goes",
      faqs: [],
    };
  }
  if (slug === "dj-session") {
    return {
      videos: [],
      hostsLabel: hostsLine("dj"),
      privateRateCents: PRIVATE_SESSION_CENTS.dj ?? 45000,
      hasDeliverable: false,
      takeHome: TAKE_HOME_DEFAULTS["dj-session"],
      perfectFor: [...(PERFECT_FOR.dj ?? [])],
      flowTitle: SESSION_FLOW_TITLE.dj ?? "How the session goes",
      faqs: [],
    };
  }
  if (slug === "sound-meditation") {
    return {
      videos: studioVideosForTag("meditation"),
      hostsLabel: hostsLine("wellness"),
      privateRateCents: PRIVATE_SESSION_CENTS.wellness ?? 120000,
      hasDeliverable: false,
      takeHome: TAKE_HOME_DEFAULTS["sound-meditation"],
      perfectFor: [...(PERFECT_FOR.wellness ?? [])],
      flowTitle: SESSION_FLOW_TITLE.wellness ?? "How the session flows",
      faqs: [],
    };
  }
  return {
    videos: [],
    hostsLabel: HOST.name,
    privateRateCents: null,
    hasDeliverable: false,
    takeHome: "",
    perfectFor: [],
    flowTitle: "How the session goes",
    faqs: [],
  };
}

export function resolveExperienceMeta(slug: string, stored?: Partial<ExperienceMeta> | null): ExperienceMeta {
  const base = defaultMetaForSlug(slug);
  if (!stored || typeof stored !== "object") return base;
  return {
    videos: Array.isArray(stored.videos) ? stored.videos : base.videos,
    hostsLabel: typeof stored.hostsLabel === "string" && stored.hostsLabel.trim() ? stored.hostsLabel.trim() : base.hostsLabel,
    privateRateCents: stored.privateRateCents === undefined ? base.privateRateCents : stored.privateRateCents,
    hasDeliverable: typeof stored.hasDeliverable === "boolean" ? stored.hasDeliverable : base.hasDeliverable,
    takeHome: typeof stored.takeHome === "string" ? stored.takeHome : base.takeHome,
    perfectFor: Array.isArray(stored.perfectFor) ? stored.perfectFor : base.perfectFor,
    flowTitle: typeof stored.flowTitle === "string" && stored.flowTitle.trim() ? stored.flowTitle.trim() : base.flowTitle,
    faqs: Array.isArray(stored.faqs) ? stored.faqs : base.faqs,
    customized: Boolean(stored.customized),
  };
}

export function isLocalAsset(src: string): boolean {
  return src.startsWith("/") && !src.startsWith("//");
}

export function isSafePhotoSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (isLocalAsset(s)) return true;
  if (/^https?:\/\/\S+$/i.test(s)) return true;
  if (/^data:image\/(jpeg|jpg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(s)) return true;
  return false;
}

export function isSafeVideoSrc(src: string): boolean {
  const s = src.trim();
  if (!s) return false;
  if (isLocalAsset(s)) return true;
  if (/^https?:\/\/\S+$/i.test(s)) return true;
  return false;
}

export type ParsedVideo =
  | { kind: "youtube"; embedUrl: string; id: string }
  | { kind: "vimeo"; embedUrl: string; id: string }
  | { kind: "file"; src: string };

export function parseVideoSource(src: string): ParsedVideo | null {
  const s = src.trim();
  if (!isSafeVideoSrc(s)) return null;
  if (isLocalAsset(s)) return { kind: "file", src: s };
  try {
    const u = new URL(s);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,20})/);
      const id = v ?? m?.[1];
      if (id && /^[\w-]{6,20}$/.test(id)) return { kind: "youtube", id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}` };
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const m = u.pathname.match(/\/(?:video\/)?(\d{5,15})/);
      if (m?.[1]) return { kind: "vimeo", id: m[1], embedUrl: `https://player.vimeo.com/video/${m[1]}` };
    }
  } catch {
    return null;
  }
  return { kind: "file", src: s };
}
