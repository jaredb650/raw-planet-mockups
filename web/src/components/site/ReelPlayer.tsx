import type { VideoItem } from "@/content/media";
import { parseVideoSource, type ExperienceVideo } from "@/lib/experience-meta";
import styles from "./ReelPlayer.module.css";

type PlayableVideo = Pick<VideoItem, "src" | "alt"> & {
  poster?: string;
  width?: number;
  height?: number;
  aspect?: ExperienceVideo["aspect"];
  caption?: string;
};

/** Video player supporting MP4/WebM reels as well as YouTube & Vimeo embeds. */
export function ReelPlayer({ video, caption, title }: { video: PlayableVideo; caption?: string; title?: string }) {
  const parsed = parseVideoSource(video.src);
  if (!parsed) return null;
  const ratio =
    video.width && video.height
      ? `${video.width} / ${video.height}`
      : video.aspect === "landscape"
        ? "16 / 9"
        : "9 / 16";

  return (
    <figure className={styles.reel}>
      <div className={styles.frame} style={{ aspectRatio: ratio }}>
        {parsed.kind === "file" ? (
          <video
            className={styles.video}
            src={parsed.src}
            poster={video.poster}
            controls
            playsInline
            preload="none"
            width={video.width}
            height={video.height}
            aria-label={title ?? video.alt}
          />
        ) : (
          <iframe
            className={styles.embed}
            src={parsed.embedUrl}
            title={title ?? video.alt}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        )}
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
