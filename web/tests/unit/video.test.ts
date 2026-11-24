import { describe, expect, it } from "vitest";
import { videoEmbed } from "@/lib/video";

describe("videoEmbed", () => {
  it("embeds YouTube and Vimeo privately", () => {
    expect(videoEmbed("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toEqual({ kind: "iframe", src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" });
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://youtube.com/shorts/dQw4w9WgXcQ")?.src).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://vimeo.com/123456")?.src).toBe("https://player.vimeo.com/video/123456?dnt=1");
  });
  it("plays direct files and site media", () => {
    expect(videoEmbed("https://cdn.example.com/a.mp4")).toEqual({ kind: "file", src: "https://cdn.example.com/a.mp4" });
    expect(videoEmbed("/media/video/guest.mp4")).toEqual({ kind: "file", src: "/media/video/guest.mp4" });
  });
  it("rejects everything else", () => {
    for (const bad of ["", "javascript:alert(1)", "http://youtu.be/dQw4w9WgXcQ", "https://evil.com/page", "/media/../secret.mp4", "https://youtube.com/watch?v=bad"])
      expect(videoEmbed(bad)).toBeNull();
  });
});
