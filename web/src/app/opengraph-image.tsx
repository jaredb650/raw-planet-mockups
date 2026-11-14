import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BUSINESS } from "@/lib/config";

export const alt = `${BUSINESS.name}: music production, DJ and meditation experiences in New York City`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Local photo, read once (Node runtime). prod-13 is a smaller file than the hero shot.
const photo = readFile(join(process.cwd(), "public/media/production/prod-13.jpg"), "base64").then((b) => `data:image/jpeg;base64,${b}`);

/**
 * Big Shoulders from Google Fonts (full latin set: once custom fonts are passed, satori has no other
 * font to fall back to). Falls back to the built-in font when offline.
 */
let fontCache: Promise<ArrayBuffer | null> | null = null;
function displayFont(): Promise<ArrayBuffer | null> {
  fontCache ??= (async () => {
    try {
      const css = await fetch("https://fonts.googleapis.com/css2?family=Big+Shoulders:wght@800", {
        signal: AbortSignal.timeout(4000),
      }).then((r) => r.text());
      const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
      if (!url) return null;
      return await fetch(url, { signal: AbortSignal.timeout(4000) }).then((r) => r.arrayBuffer());
    } catch {
      return null;
    }
  })();
  return fontCache;
}

export default async function OpengraphImage() {
  const [src, font] = await Promise.all([photo, displayFont()]);
  const display = font ? "Big Shoulders" : undefined;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#fffcf7", color: "#0e1e48", fontFamily: display }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 56px 56px 72px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 30, fontWeight: 800, letterSpacing: 1, fontFamily: display }}>
            <div style={{ width: 30, height: 30, borderRadius: 30, background: "#ee5622" }} />
            RAW PLANET
          </div>
          <div style={{ display: "flex", flexDirection: "column", fontFamily: display, fontWeight: 800, fontSize: font ? 100 : 80, lineHeight: 0.9 }}>
            <span>MUSIC EXPERIENCES</span>
            <span style={{ color: "#ee5622" }}>IN NEW YORK CITY</span>
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: font ? 30 : 24 }}>
            {["Music production", "Learn to DJ", "Meditation"].map((t, i) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  padding: "10px 20px",
                  borderRadius: 999,
                  background: ["#4fb3d9", "#f47a3a", "#8cb54a"][i],
                  color: "#0e1e48",
                  fontWeight: 700,
                }}
              >
                {t.toUpperCase()}
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: 430, display: "flex", padding: "40px 40px 40px 0" }}>
          <img src={src} alt="" width={390} height={550} style={{ width: 390, height: 550, objectFit: "cover", borderRadius: 28 }} />
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Big Shoulders", data: font, weight: 800, style: "normal" }] : undefined },
  );
}
