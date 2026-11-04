"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./LoopVideo.module.css";

/**
 * Muted background loop. Only plays while on screen, never autoplays when the
 * visitor prefers reduced motion, and always has a pause control (WCAG 2.2.2).
 */
export function LoopVideo({
  src,
  poster,
  label,
  className,
  objectPosition,
}: {
  src: string;
  poster: string;
  label: string;
  className?: string;
  objectPosition?: string;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches || userPaused) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.2 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [userPaused]);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      setUserPaused(false);
      v.play().catch(() => {});
    } else {
      setUserPaused(true);
      v.pause();
    }
  };

  return (
    <div className={`${styles.wrap} ${className ?? ""}`}>
      <video
        ref={ref}
        className={styles.video}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        preload="none"
        aria-label={label}
        style={objectPosition ? { objectPosition } : undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button type="button" className={styles.toggle} onClick={toggle} aria-pressed={!playing}>
        <span className="sr-only">{playing ? "Pause background video" : "Play background video"}</span>
        <span aria-hidden="true" className={playing ? styles.pause : styles.play} />
      </button>
    </div>
  );
}
