/**
 * Email design tokens. Email clients ignore CSS variables and most web fonts,
 * so everything here is a literal value used in inline styles.
 */
export const C = {
  brick: "#B8482E",
  brickDark: "#9A3B25",
  ochre: "#E0A030",
  orange: "#E8703A",
  green: "#8DB66F",
  powder: "#C9DCE3",
  cream: "#F7E7C6",
  cocoa: "#3A2212",
  paper: "#FFFDF8",
  mist: "#FBF3E4",
  line: "#EAD9BB",
  inkSoft: "#6E5747",
  inkFaint: "#8F7B6B",
  white: "#FFFFFF",
  success: "#3F7D3A",
  successSoft: "#E3F0DC",
  danger: "#A3341F",
  dangerSoft: "#F9E0D9",
  warningSoft: "#FDF0CF",
} as const;

export type ThemeKey = "production" | "dj" | "wellness" | "brand";

/** Accent per experience. `soft` is a pale tint for panels; text on either stays cocoa. */
export const ACCENTS: Record<ThemeKey, { strong: string; soft: string; emoji: string }> = {
  production: { strong: C.ochre, soft: "#FBECC9", emoji: "🎙" },
  dj: { strong: C.orange, soft: "#FBE1D3", emoji: "🎛" },
  wellness: { strong: C.green, soft: "#E8F1DF", emoji: "🔔" },
  brand: { strong: C.brick, soft: "#F6DFD6", emoji: "✦" },
};

export function accentFor(theme: string | null | undefined) {
  return ACCENTS[(theme as ThemeKey) in ACCENTS ? (theme as ThemeKey) : "brand"];
}

export const FONT_DISPLAY = "'Big Shoulders Display','Big Shoulders',Impact,'Arial Narrow Bold','Arial Narrow',Arial,sans-serif";
export const FONT_BODY = "'DM Sans',Helvetica,Arial,sans-serif";
export const FONT_MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
