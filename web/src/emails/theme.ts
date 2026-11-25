/**
 * Email design tokens — matched to the current white & purple site theme
 * (Unbounded display + DM Sans body). Email clients ignore CSS variables,
 * so everything here is a literal value used in inline styles.
 */
export const C = {
  purple: "#7E56A4",
  purpleDark: "#5F3E82",
  purpleLight: "#B598D6",
  brick: "#7E56A4",
  brickDark: "#5F3E82",
  ochre: "#7E56A4",
  orange: "#D9784A",
  green: "#8CB54A",
  powder: "#ECE3F5",
  canvas: "#F5F0FA",
  cream: "#F5F0FA",
  cocoa: "#1F1C24",
  paper: "#FFFFFF",
  mist: "#F7F3FC",
  line: "#E5DBF0",
  inkSoft: "#585163",
  inkFaint: "#857C92",
  white: "#FFFFFF",
  success: "#3F7D3A",
  successSoft: "#E3F0DC",
  danger: "#A3341F",
  dangerSoft: "#F9E0D9",
  warningSoft: "#FDF0CF",
} as const;

export type ThemeKey = "production" | "dj" | "wellness" | "brand";

/** Accent per experience. Default brand accent is Raw Planet purple. */
export const ACCENTS: Record<ThemeKey, { strong: string; soft: string; emoji: string }> = {
  production: { strong: C.purple, soft: "#ECE3F5", emoji: "🎙" },
  dj: { strong: C.orange, soft: "#F8E2D6", emoji: "🎛" },
  wellness: { strong: C.green, soft: "#E7F1D6", emoji: "🔔" },
  brand: { strong: C.purple, soft: "#ECE3F5", emoji: "✦" },
};

export function accentFor(theme: string | null | undefined) {
  return ACCENTS[(theme as ThemeKey) in ACCENTS ? (theme as ThemeKey) : "brand"];
}

export const FONT_DISPLAY = "'Unbounded','DM Sans',Helvetica,Arial,sans-serif";
export const FONT_BODY = "'DM Sans',Helvetica,Arial,sans-serif";
export const FONT_MONO = "'SFMono-Regular',Menlo,Consolas,'Courier New',monospace";
