/**
 * Email design tokens. Email clients ignore CSS variables and most web fonts,
 * so everything here is a literal value used in inline styles.
 */
export const C = {
  brick: "#EE5622",
  brickDark: "#C9431A",
  ochre: "#4FB3D9",
  orange: "#F47A3A",
  green: "#8CB54A",
  powder: "#CFE8F3",
  cream: "#FBEEDB",
  cocoa: "#0E1E48",
  paper: "#FFFCF7",
  mist: "#F7EFE2",
  line: "#E6DCCB",
  inkSoft: "#4A5475",
  inkFaint: "#7C86A0",
  white: "#FFFFFF",
  success: "#3F7D3A",
  successSoft: "#E3F0DC",
  danger: "#A3341F",
  dangerSoft: "#F9E0D9",
  warningSoft: "#FDF0CF",
} as const;

export type ThemeKey = "production" | "dj" | "wellness" | "brand";

/** Accent per experience. `soft` is a pale tint for panels; text on either stays cocoa (navy). */
export const ACCENTS: Record<ThemeKey, { strong: string; soft: string; emoji: string }> = {
  production: { strong: C.ochre, soft: "#DBF0F8", emoji: "🎙" },
  dj: { strong: C.orange, soft: "#FFE3D3", emoji: "🎛" },
  wellness: { strong: C.green, soft: "#E7F1D6", emoji: "🔔" },
  brand: { strong: C.brick, soft: "#FDE1D5", emoji: "✦" },
};

export function accentFor(theme: string | null | undefined) {
  return ACCENTS[(theme as ThemeKey) in ACCENTS ? (theme as ThemeKey) : "brand"];
}

export const FONT_DISPLAY = "'Big Shoulders Display','Big Shoulders',Impact,'Arial Narrow Bold','Arial Narrow',Arial,sans-serif";
export const FONT_BODY = "'DM Sans',Helvetica,Arial,sans-serif";
export const FONT_MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
