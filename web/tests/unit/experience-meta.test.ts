import { describe, expect, it } from "vitest";
import {
  defaultMetaForSlug,
  isLocalAsset,
  isOriginalExperienceSlug,
  isSafePhotoSrc,
  parseVideoSource,
  resolveExperienceMeta,
} from "@/lib/experience-meta";

describe("experience-meta", () => {
  it("scopes legacy defaults strictly to the 3 original slugs", () => {
    expect(isOriginalExperienceSlug("music-production")).toBe(true);
    expect(isOriginalExperienceSlug("dj-session")).toBe(true);
    expect(isOriginalExperienceSlug("sound-meditation")).toBe(true);
    expect(isOriginalExperienceSlug("beat-making-for-kids")).toBe(false);

    expect(defaultMetaForSlug("music-production").hasDeliverable).toBe(true);
    expect(defaultMetaForSlug("music-production").privateRateCents).toBe(65000);
    expect(defaultMetaForSlug("dj-session").hasDeliverable).toBe(false);
    expect(defaultMetaForSlug("dj-session").privateRateCents).toBe(45000);
    expect(defaultMetaForSlug("sound-meditation").hasDeliverable).toBe(false);
    expect(defaultMetaForSlug("sound-meditation").privateRateCents).toBeNull();

    const custom = defaultMetaForSlug("beat-making-for-kids");
    expect(custom.hasDeliverable).toBe(false);
    expect(custom.privateRateCents).toBeNull();
    expect(custom.hostsLabel).toBe("Alex Gentil");
    expect(custom.videos).toEqual([]);
    expect(custom.perfectFor).toEqual([]);
  });

  it("respects explicit admin overrides including clearing private rate or videos", () => {
    const merged = resolveExperienceMeta("music-production", {
      privateRateCents: null,
      hasDeliverable: false,
      videos: [],
      hostsLabel: "Alex Gentil and Guest Host",
      customized: true,
    });
    expect(merged.privateRateCents).toBeNull();
    expect(merged.hasDeliverable).toBe(false);
    expect(merged.videos).toEqual([]);
    expect(merged.hostsLabel).toBe("Alex Gentil and Guest Host");
  });

  it("parses YouTube, Vimeo, and direct video sources cleanly", () => {
    expect(parseVideoSource("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({
      kind: "youtube",
      id: "dQw4w9WgXcQ",
      embedUrl: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    });
    expect(parseVideoSource("https://youtu.be/dQw4w9WgXcQ")).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoSource("https://youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ kind: "youtube", id: "dQw4w9WgXcQ" });
    expect(parseVideoSource("https://vimeo.com/123456789")).toEqual({
      kind: "vimeo",
      id: "123456789",
      embedUrl: "https://player.vimeo.com/video/123456789",
    });
    expect(parseVideoSource("/media/video/production.mp4")).toEqual({ kind: "file", src: "/media/video/production.mp4" });
    expect(parseVideoSource("javascript:alert(1)")).toBeNull();
  });

  it("validates local, https, and base64 image sources safely", () => {
    expect(isLocalAsset("/media/dj/dj-01.jpg")).toBe(true);
    expect(isLocalAsset("https://example.com/a.jpg")).toBe(false);
    expect(isLocalAsset("data:image/jpeg;base64,AAAA")).toBe(false);
    expect(isSafePhotoSrc("/media/dj/dj-01.jpg")).toBe(true);
    expect(isSafePhotoSrc("https://example.com/a.jpg")).toBe(true);
    expect(isSafePhotoSrc("data:image/jpeg;base64,AAAA")).toBe(true);
    expect(isSafePhotoSrc("data:text/html;base64,AAAA")).toBe(false);
    expect(isSafePhotoSrc("javascript:alert(1)")).toBe(false);
  });
});
