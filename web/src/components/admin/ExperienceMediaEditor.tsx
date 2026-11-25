"use client";

import { useState, useRef } from "react";
import { djPhotos, hostPhotos, meditationStills, productionPhotos, videos as studioVideos } from "@/content/media";
import {
  isSafePhotoSrc,
  parseVideoSource,
  type ExperienceFaqItem,
  type ExperienceVideo,
} from "@/lib/experience-meta";
import type { ExperienceMedia } from "@/lib/db/schema";
import a from "./admin.module.css";
import e from "./exp.module.css";

const MAX_PHOTOS = 16;
const MAX_VIDEOS = 8;
const MAX_DIMENSION = 1400;

const STUDIO_PHOTOS: { group: string; items: { src: string; alt: string; width: number; height: number }[] }[] = [
  { group: "Production studio", items: productionPhotos.map((p) => ({ src: p.src, alt: p.alt, width: p.width, height: p.height })) },
  { group: "DJ studio", items: djPhotos.map((p) => ({ src: p.src, alt: p.alt, width: p.width, height: p.height })) },
  { group: "Sound meditation", items: meditationStills.map((p) => ({ src: p.src, alt: p.alt, width: p.width, height: p.height })) },
  { group: "Host & co-hosts", items: hostPhotos.map((p) => ({ src: p.src, alt: p.alt, width: p.width, height: p.height })) },
];

const STUDIO_VIDEOS = studioVideos
  .filter((v) => !v.loop)
  .map((v) => ({
    src: v.src,
    alt: v.alt,
    poster: v.poster,
    caption: v.caption,
    aspect: (v.width > v.height ? "landscape" : "portrait") as "portrait" | "landscape",
  }));

async function compressImageFile(file: File): Promise<{ src: string; width: number; height: number }> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not read image file."));
      el.src = objectUrl;
    });
    const ratio = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const width = Math.max(1, Math.round((img.naturalWidth || 1200) * ratio));
    const height = Math.max(1, Math.round((img.naturalHeight || 800) * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Browser canvas unavailable.");
    ctx.drawImage(img, 0, 0, width, height);

    let dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    if (dataUrl.length > 480_000) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.68);
    }
    if (dataUrl.length > 700_000) {
      throw new Error(`${file.name} is still too large after compression. Try a smaller image or paste an image URL.`);
    }
    return { src: dataUrl, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function altFromFilename(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

export function ExperienceMediaEditor({
  initialPhotos,
  initialVideos,
}: {
  initialPhotos: ExperienceMedia[];
  initialVideos: ExperienceVideo[];
}) {
  const [photos, setPhotos] = useState<ExperienceMedia[]>(initialPhotos);
  const [videos, setVideos] = useState<ExperienceVideo[]>(initialVideos);
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoErr, setPhotoErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [videoUrl, setVideoUrl] = useState("");
  const [videoErr, setVideoErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(files: FileList | null) {
    if (!files || files.length === 0) return;
    setPhotoErr(null);
    setUploading(true);
    try {
      const remaining = MAX_PHOTOS - photos.length;
      if (remaining <= 0) {
        setPhotoErr(`Maximum ${MAX_PHOTOS} photos per experience.`);
        return;
      }
      const next: ExperienceMedia[] = [];
      for (const file of Array.from(files).slice(0, remaining)) {
        if (!file.type.startsWith("image/")) {
          setPhotoErr(`${file.name} is not an image file.`);
          continue;
        }
        const compressed = await compressImageFile(file);
        next.push({
          src: compressed.src,
          alt: altFromFilename(file.name) || "Experience photo",
          width: compressed.width,
          height: compressed.height,
        });
      }
      if (next.length) setPhotos((cur) => [...cur, ...next]);
    } catch (err) {
      setPhotoErr(err instanceof Error ? err.message : "Could not process image.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addPhotoByUrl() {
    const trimmed = photoUrl.trim();
    if (!trimmed) return;
    if (!isSafePhotoSrc(trimmed)) {
      setPhotoErr("Enter a valid https:// image link or /media/… path.");
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setPhotoErr(`Maximum ${MAX_PHOTOS} photos per experience.`);
      return;
    }
    if (photos.some((p) => p.src === trimmed)) {
      setPhotoErr("That photo is already added.");
      return;
    }
    setPhotoErr(null);
    setPhotos((cur) => [...cur, { src: trimmed, alt: "Experience photo" }]);
    setPhotoUrl("");
  }

  function toggleLibraryPhoto(item: { src: string; alt: string; width: number; height: number }) {
    setPhotoErr(null);
    setPhotos((cur) => {
      if (cur.some((p) => p.src === item.src)) return cur.filter((p) => p.src !== item.src);
      if (cur.length >= MAX_PHOTOS) {
        setPhotoErr(`Maximum ${MAX_PHOTOS} photos per experience.`);
        return cur;
      }
      return [...cur, item];
    });
  }

  function movePhoto(index: number, delta: number) {
    setPhotos((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur.length) return cur;
      const copy = [...cur];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  function addVideoByUrl() {
    const trimmed = videoUrl.trim();
    if (!trimmed) return;
    const parsed = parseVideoSource(trimmed);
    if (!parsed) {
      setVideoErr("Enter a YouTube link, Vimeo link, or direct https:// .mp4/.webm URL.");
      return;
    }
    if (videos.length >= MAX_VIDEOS) {
      setVideoErr(`Maximum ${MAX_VIDEOS} videos per experience.`);
      return;
    }
    if (videos.some((v) => v.src === trimmed)) {
      setVideoErr("That video is already added.");
      return;
    }
    setVideoErr(null);
    const isShorts = /youtube\.com\/shorts\//i.test(trimmed);
    setVideos((cur) => [
      ...cur,
      {
        src: trimmed,
        alt: "Session video",
        aspect: parsed.kind === "file" || isShorts ? "portrait" : "landscape",
      },
    ]);
    setVideoUrl("");
  }

  function addStudioVideo(item: ExperienceVideo) {
    setVideoErr(null);
    setVideos((cur) => {
      if (cur.some((v) => v.src === item.src)) return cur;
      if (cur.length >= MAX_VIDEOS) {
        setVideoErr(`Maximum ${MAX_VIDEOS} videos per experience.`);
        return cur;
      }
      return [...cur, { ...item }];
    });
  }

  function moveVideo(index: number, delta: number) {
    setVideos((cur) => {
      const target = index + delta;
      if (target < 0 || target >= cur.length) return cur;
      const copy = [...cur];
      const [item] = copy.splice(index, 1);
      copy.splice(target, 0, item);
      return copy;
    });
  }

  return (
    <div className={a.form}>
      <input type="hidden" name="mediaJson" value={JSON.stringify(photos)} />
      <input type="hidden" name="videosJson" value={JSON.stringify(videos)} />

      {/* ---------------- PHOTOS ---------------- */}
      <div className={a.field}>
        <span className={a.label}>Photos ({photos.length}/{MAX_PHOTOS})</span>
        <span className={a.hint}>The first photo is the cover image on cards and the top of the experience page.</span>

        {photos.length > 0 ? (
          <div className={e.photoList}>
            {photos.map((p, i) => (
              <div key={`${p.src.slice(0, 64)}-${i}`} className={e.photoCard}>
                <div className={e.photoThumbWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={p.alt} className={e.photoThumb} loading="lazy" />
                  {i === 0 && <span className={e.coverTag}>Cover</span>}
                </div>
                <div className={e.photoControls}>
                  <input
                    type="text"
                    className={`${a.input} ${a.inputSm}`}
                    value={p.alt}
                    placeholder="Photo description (alt text)"
                    aria-label={`Photo ${i + 1} description`}
                    onChange={(ev) =>
                      setPhotos((cur) => cur.map((item, idx) => (idx === i ? { ...item, alt: ev.target.value } : item)))
                    }
                  />
                  <div className={a.row} style={{ gap: 6 }}>
                    {i > 0 && (
                      <button type="button" className={`${a.btn} ${a.btnSm}`} onClick={() => movePhoto(i, -1)}>
                        ← Left
                      </button>
                    )}
                    {i < photos.length - 1 && (
                      <button type="button" className={`${a.btn} ${a.btnSm}`} onClick={() => movePhoto(i, 1)}>
                        Right →
                      </button>
                    )}
                    <button
                      type="button"
                      className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}
                      onClick={() => setPhotos((cur) => cur.filter((_, idx) => idx !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={`${a.small} ${a.muted}`} style={{ margin: "4px 0" }}>
            No photos yet. Upload from your device, paste a link, or pick from the studio library below.
          </p>
        )}

        <div className={e.addBar}>
          <label className={`${a.btn} ${a.btnSm}`} style={{ cursor: "pointer" }}>
            {uploading ? "Processing…" : "Upload photo(s)"}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              disabled={uploading}
              style={{ display: "none" }}
              onChange={(ev) => void handleFileChange(ev.target.files)}
            />
          </label>
          <input
            type="url"
            className={`${a.input} ${a.inputSm}`}
            style={{ flex: "1 1 200px" }}
            placeholder="Or paste image URL (https://…)"
            value={photoUrl}
            onChange={(ev) => setPhotoUrl(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                addPhotoByUrl();
              }
            }}
          />
          <button type="button" className={`${a.btn} ${a.btnSm}`} onClick={addPhotoByUrl}>
            Add URL
          </button>
        </div>
        {photoErr && (
          <p className={`${a.small}`} style={{ color: "var(--a-bad)", margin: "4px 0 0" }}>
            {photoErr}
          </p>
        )}

        <details className={a.disclosure} style={{ marginTop: 8 }}>
          <summary>Pick from studio photo library</summary>
          <div className={a.disclosureBody}>
            {STUDIO_PHOTOS.map((grp) => (
              <div key={grp.group} style={{ marginBottom: 14 }}>
                <p className={`${a.small} ${a.muted}`} style={{ margin: "0 0 6px", fontWeight: 600 }}>
                  {grp.group}
                </p>
                <div className={e.libGrid}>
                  {grp.items.map((item) => {
                    const selected = photos.some((p) => p.src === item.src);
                    return (
                      <button
                        key={item.src}
                        type="button"
                        className={`${e.libBtn} ${selected ? e.libBtnActive : ""}`}
                        onClick={() => toggleLibraryPhoto(item)}
                        title={item.alt}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.src} alt={item.alt} loading="lazy" />
                        {selected && <span className={e.libCheck}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>

      {/* ---------------- VIDEOS ---------------- */}
      <div className={a.field} style={{ paddingTop: 12, borderTop: "1px solid var(--a-line)" }}>
        <span className={a.label}>Videos ({videos.length}/{MAX_VIDEOS})</span>
        <span className={a.hint}>Add YouTube, Vimeo, direct MP4/WebM links, or pick a built-in studio clip.</span>

        {videos.length > 0 && (
          <div className={e.videoList}>
            {videos.map((v, i) => {
              const parsed = parseVideoSource(v.src);
              const badge =
                parsed?.kind === "youtube" ? "YouTube" : parsed?.kind === "vimeo" ? "Vimeo" : v.src.startsWith("/media/") ? "Studio video" : "MP4 / Video";
              return (
                <div key={`${v.src}-${i}`} className={e.videoCard}>
                  <div className={a.rowBetween} style={{ gap: 8 }}>
                    <span className={`${a.small}`} style={{ fontWeight: 600, wordBreak: "break-all" }}>
                      [{badge}] {v.src}
                    </span>
                    <div className={a.row} style={{ gap: 6, flexShrink: 0 }}>
                      {i > 0 && (
                        <button type="button" className={`${a.btn} ${a.btnSm}`} onClick={() => moveVideo(i, -1)}>
                          ↑
                        </button>
                      )}
                      {i < videos.length - 1 && (
                        <button type="button" className={`${a.btn} ${a.btnSm}`} onClick={() => moveVideo(i, 1)}>
                          ↓
                        </button>
                      )}
                      <button
                        type="button"
                        className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}
                        onClick={() => setVideos((cur) => cur.filter((_, idx) => idx !== i))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className={a.formRow} style={{ ["--cols" as string]: 3 }}>
                    <input
                      type="text"
                      className={`${a.input} ${a.inputSm}`}
                      value={v.alt}
                      placeholder="Video title / description"
                      aria-label={`Video ${i + 1} title`}
                      onChange={(ev) =>
                        setVideos((cur) => cur.map((item, idx) => (idx === i ? { ...item, alt: ev.target.value } : item)))
                      }
                    />
                    <input
                      type="text"
                      className={`${a.input} ${a.inputSm}`}
                      value={v.caption ?? ""}
                      placeholder="Caption (optional)"
                      aria-label={`Video ${i + 1} caption`}
                      onChange={(ev) =>
                        setVideos((cur) => cur.map((item, idx) => (idx === i ? { ...item, caption: ev.target.value || undefined } : item)))
                      }
                    />
                    <select
                      className={`${a.select} ${a.inputSm}`}
                      value={v.aspect ?? "portrait"}
                      aria-label={`Video ${i + 1} shape`}
                      onChange={(ev) =>
                        setVideos((cur) =>
                          cur.map((item, idx) =>
                            idx === i ? { ...item, aspect: ev.target.value === "landscape" ? "landscape" : "portrait" } : item,
                          ),
                        )
                      }
                    >
                      <option value="portrait">Portrait (9:16 reel)</option>
                      <option value="landscape">Landscape (16:9)</option>
                    </select>
                  </div>
                  {parsed?.kind === "file" && (
                    <input
                      type="text"
                      className={`${a.input} ${a.inputSm}`}
                      value={v.poster ?? ""}
                      placeholder="Optional poster thumbnail URL (/media/… or https://…)"
                      aria-label={`Video ${i + 1} poster`}
                      onChange={(ev) =>
                        setVideos((cur) => cur.map((item, idx) => (idx === i ? { ...item, poster: ev.target.value.trim() || undefined } : item)))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className={e.addBar}>
          <input
            type="url"
            className={`${a.input} ${a.inputSm}`}
            style={{ flex: "1 1 240px" }}
            placeholder="Paste YouTube, Vimeo, or .mp4 URL"
            value={videoUrl}
            onChange={(ev) => setVideoUrl(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                addVideoByUrl();
              }
            }}
          />
          <button type="button" className={`${a.btn} ${a.btnSm}`} onClick={addVideoByUrl}>
            Add video
          </button>
        </div>
        {videoErr && (
          <p className={`${a.small}`} style={{ color: "var(--a-bad)", margin: "4px 0 0" }}>
            {videoErr}
          </p>
        )}

        <details className={a.disclosure} style={{ marginTop: 8 }}>
          <summary>Pick from studio videos</summary>
          <div className={a.disclosureBody}>
            <div className={a.row} style={{ gap: 8, flexWrap: "wrap" }}>
              {STUDIO_VIDEOS.map((sv) => {
                const added = videos.some((v) => v.src === sv.src);
                return (
                  <button
                    key={sv.src}
                    type="button"
                    className={`${a.btn} ${a.btnSm}`}
                    disabled={added}
                    onClick={() => addStudioVideo(sv)}
                  >
                    {added ? "✓ Added: " : "+ "}
                    {sv.caption || sv.src.split("/").pop()}
                  </button>
                );
              })}
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}

export function ExperienceFaqEditor({ initialFaqs }: { initialFaqs: ExperienceFaqItem[] }) {
  const [faqs, setFaqs] = useState<ExperienceFaqItem[]>(initialFaqs);

  return (
    <div className={a.field}>
      <input type="hidden" name="faqsJson" value={JSON.stringify(faqs)} />
      <span className={a.label}>Experience-specific FAQs (optional)</span>
      <span className={a.hint}>
        Add custom questions &amp; answers for this experience. Leave empty to show the site’s default FAQs.
      </span>

      {faqs.map((item, i) => (
        <div key={i} className={e.videoCard}>
          <div className={a.rowBetween} style={{ gap: 8 }}>
            <input
              type="text"
              className={`${a.input} ${a.inputSm}`}
              style={{ flex: 1 }}
              value={item.q}
              placeholder="Question (e.g. Do I need to bring my own gear?)"
              aria-label={`FAQ ${i + 1} question`}
              onChange={(ev) => setFaqs((cur) => cur.map((f, idx) => (idx === i ? { ...f, q: ev.target.value } : f)))}
            />
            <button
              type="button"
              className={`${a.btn} ${a.btnSm} ${a.btnGhost}`}
              onClick={() => setFaqs((cur) => cur.filter((_, idx) => idx !== i))}
            >
              Remove
            </button>
          </div>
          <textarea
            className={a.textarea}
            rows={2}
            value={item.a}
            placeholder="Answer"
            aria-label={`FAQ ${i + 1} answer`}
            onChange={(ev) => setFaqs((cur) => cur.map((f, idx) => (idx === i ? { ...f, a: ev.target.value } : f)))}
          />
        </div>
      ))}

      <div>
        <button
          type="button"
          className={`${a.btn} ${a.btnSm}`}
          onClick={() => setFaqs((cur) => [...cur, { q: "", a: "" }])}
          disabled={faqs.length >= 12}
        >
          + Add question
        </button>
      </div>
    </div>
  );
}
