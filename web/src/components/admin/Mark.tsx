/** Raw Planet mark: a planet with a tilted ring, in brick. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden style={{ flex: "none" }}>
      <circle cx="16" cy="16" r="9" fill="var(--brick)" />
      <ellipse cx="16" cy="16" rx="15" ry="5.2" fill="none" stroke="var(--cocoa)" strokeWidth="2" transform="rotate(-22 16 16)" />
      <path d="M7.2 13.2a9 9 0 0 1 17.6 0" fill="var(--brick)" />
    </svg>
  );
}
