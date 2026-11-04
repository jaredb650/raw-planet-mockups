import { videoEmbed } from "@/lib/video";
import styles from "./ReelPlayer.module.css";

/** A guest's video testimonial (YouTube/Vimeo privacy embed or a plain video file). Loads nothing until played. */
export function GuestVideo({ url, title }: { url: string; title: string }) {
  const v = videoEmbed(url);
  if (!v) return null;
  return (
    <div className={styles.frame} style={{ aspectRatio: "9 / 16" }}>
      {v.kind === "iframe" ? (
        <iframe
          src={v.src}
          title={title}
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          style={{ border: 0, width: "100%", height: "100%" }}
        />
      ) : (
        // #t=0.1 + preload=metadata paints the first frame as a poster without downloading the video.
        <video className={styles.video} src={`${v.src}#t=0.1`} controls preload="metadata" playsInline aria-label={title} />
      )}
    </div>
  );
}
