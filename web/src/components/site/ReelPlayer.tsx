import type { VideoItem } from "@/content/media";
import styles from "./ReelPlayer.module.css";

/** Portrait video with sound + native controls. Loads nothing until played. */
export function ReelPlayer({ video, caption, title }: { video: VideoItem; caption?: string; title?: string }) {
  return (
    <figure className={styles.reel}>
      <div className={styles.frame} style={{ aspectRatio: `${video.width} / ${video.height}` }}>
        <video
          className={styles.video}
          src={video.src}
          poster={video.poster}
          controls
          playsInline
          preload="none"
          width={video.width}
          height={video.height}
          aria-label={title ?? video.alt}
        />
      </div>
      {caption ? <figcaption className={styles.caption}>{caption}</figcaption> : null}
    </figure>
  );
}
