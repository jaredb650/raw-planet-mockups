/** Decorative line icons for the three experiences (stroke = currentColor). */
export function MoodIcon({ theme, className }: { theme: string; className?: string }) {
  if (theme === "dj") {
    return (
      <svg viewBox="0 0 110 110" className={className} aria-hidden="true" data-icon="dj">
        <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round">
          <circle cx="52" cy="58" r="44" />
          <circle cx="52" cy="58" r="30" strokeWidth="2.5" opacity=".55" />
          <circle cx="52" cy="58" r="18" strokeWidth="2.5" opacity=".55" />
          <path d="M100 8 L100 30 L74 62" />
        </g>
        <circle cx="52" cy="58" r="7" fill="currentColor" />
        <circle cx="100" cy="8" r="6" fill="currentColor" />
      </svg>
    );
  }
  if (theme === "wellness") {
    return (
      <svg viewBox="0 0 110 110" className={className} aria-hidden="true" data-icon="wellness">
        <g fill="none" stroke="currentColor" strokeWidth="4">
          <circle cx="55" cy="55" r="12" fill="currentColor" />
          <circle cx="55" cy="55" r="27" />
          <circle cx="55" cy="55" r="40" opacity=".55" />
          <circle cx="55" cy="55" r="52" opacity=".28" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 110 110" className={className} aria-hidden="true" data-icon="production">
      <g fill="none" stroke="currentColor" strokeWidth="5">
        {[0, 1, 2].flatMap((r) =>
          [0, 1, 2].map((c) => (
            <rect
              key={`${r}-${c}`}
              x={4 + c * 36}
              y={4 + r * 36}
              width="30"
              height="30"
              rx="7"
              fill={(r * 3 + c) % 4 === 1 ? "currentColor" : "none"}
              data-pad={r * 3 + c}
            />
          )),
        )}
      </g>
    </svg>
  );
}
