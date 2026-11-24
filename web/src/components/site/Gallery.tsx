"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Photo } from "./media";
import styles from "./Gallery.module.css";

/**
 * Listing-style photo mosaic (1 large + 4 small on desktop, swipeable strip on
 * mobile) with a keyboard-operable lightbox built on <dialog>.
 */
export function Gallery({ photos, title }: { photos: Photo[]; title: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState<number | null>(null);
  const shown = photos.slice(0, 5);
  const count = photos.length;

  const open = (i: number) => {
    setIndex(i);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const step = useCallback((d: number) => setIndex((i) => (i === null ? i : (i + d + count) % count)), [count]);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    const onClose = () => setIndex(null);
    dlg.addEventListener("keydown", onKey);
    dlg.addEventListener("close", onClose);
    return () => {
      dlg.removeEventListener("keydown", onKey);
      dlg.removeEventListener("close", onClose);
    };
  }, [step]);

  // Touch swipe inside the lightbox.
  const touchX = useRef<number | null>(null);

  if (!photos.length) return null;
  const current = index !== null ? photos[index] : null;

  return (
    <div className={styles.gallery}>
      <ul className={styles.grid} data-count={Math.min(shown.length, 5)} aria-label={`${title} photos`}>
        {shown.map((p, i) => (
          <li key={p.src} className={styles.tile}>
            <button type="button" className={styles.tileBtn} onClick={() => open(i)} aria-label={`Open photo ${i + 1} of ${count}: ${p.alt}`}>
              <Image
                src={p.src}
                alt=""
                fill
                sizes={i === 0 ? "(max-width: 760px) 86vw, 600px" : "(max-width: 760px) 86vw, 300px"}
                preload={i === 0}
                className={styles.img}
              />
            </button>
          </li>
        ))}
      </ul>
      {count > 1 ? (
        <button type="button" className={`btn btn--sm ${styles.all}`} onClick={() => open(0)}>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <g fill="currentColor">
              <rect x="1" y="1" width="6" height="6" rx="1.5" />
              <rect x="9" y="1" width="6" height="6" rx="1.5" />
              <rect x="1" y="9" width="6" height="6" rx="1.5" />
              <rect x="9" y="9" width="6" height="6" rx="1.5" />
            </g>
          </svg>
          Show all {count} photos
        </button>
      ) : null}

      <dialog
        ref={dialogRef}
        className={styles.lightbox}
        aria-label={`${title} photo viewer`}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
          touchX.current = null;
        }}
      >
        {current ? (
          <div className={styles.lbInner}>
            <div className={styles.lbBar}>
              <span className="tabular" aria-live="polite">
                {index! + 1} / {count}
              </span>
              <button type="button" className={styles.lbClose} onClick={close} autoFocus>
                <span className="sr-only">Close photo viewer</span>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <figure className={styles.lbFigure}>
              <div className={styles.lbImgWrap}>
                <Image key={current.src} src={current.src} alt={current.alt} fill sizes="100vw" className={styles.lbImg} />
              </div>
              <figcaption className={styles.lbCaption}>{current.alt}</figcaption>
            </figure>
            {count > 1 ? (
              <>
                <button type="button" className={`${styles.lbNav} ${styles.lbPrev}`} onClick={() => step(-1)}>
                  <span className="sr-only">Previous photo</span>
                  <span aria-hidden="true">‹</span>
                </button>
                <button type="button" className={`${styles.lbNav} ${styles.lbNext}`} onClick={() => step(1)}>
                  <span className="sr-only">Next photo</span>
                  <span aria-hidden="true">›</span>
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
