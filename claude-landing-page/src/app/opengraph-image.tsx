import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "Telegate — More life. Less screen.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadNunito(): Promise<ArrayBuffer | null> {
  try {
    // A plain user agent makes Google Fonts serve TTF, which Satori can read (no woff2).
    const css = await fetch("https://fonts.googleapis.com/css2?family=Nunito:wght@800&display=swap", {
      headers: { "User-Agent": "Mozilla/5.0" },
    }).then((r) => r.text());
    const url = css.match(/url\(([^)]+)\) format\('(?:truetype|opentype)'\)/)?.[1] ?? css.match(/url\(([^)]+\.ttf)\)/)?.[1];
    if (!url) return null;
    return await fetch(url).then((r) => r.arrayBuffer());
  } catch {
    return null;
  }
}

async function loadIcon(): Promise<string> {
  const png = await readFile(join(process.cwd(), "public", "brand", "telegate-icon.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}

export default async function OpenGraphImage() {
  const [nunito, icon] = await Promise.all([loadNunito(), loadIcon()]);
  const bars = [14, 30, 52, 38, 64, 46, 28, 58, 40, 22, 48, 34, 60, 26, 44, 18];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#14212a",
          color: "#f5f7f0",
          fontFamily: nunito ? "Nunito" : "sans-serif",
          padding: 72,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", right: -120, top: -120, width: 620, height: 620, borderRadius: 9999, background: "radial-gradient(circle, rgba(173,242,143,0.35) 0%, rgba(173,242,143,0) 65%)" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={icon} width={56} height={56} style={{ borderRadius: 16 }} alt="" />
            <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: -1.6 }}>telegate</div>
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "flex-end", gap: 6, height: 70 }}>
              {bars.map((h, i) => (
                <div key={i} style={{ width: 8, height: h, borderRadius: 4, background: "#adf28f" }} />
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, lineHeight: 0.98 }}>More life.</div>
            <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, lineHeight: 0.98, color: "#adf28f" }}>Less screen.</div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 32, fontSize: 26, color: "#9fb0b8" }}>
            <div>Talk it through. Send it to the agents at home.</div>
            <div style={{ display: "flex", gap: 10, fontSize: 20, color: "#f5f7f0" }}>
              <span style={{ border: "1px solid rgba(245,247,240,0.25)", borderRadius: 999, padding: "6px 14px" }}>MIT</span>
              <span style={{ border: "1px solid rgba(245,247,240,0.25)", borderRadius: 999, padding: "6px 14px" }}>self-hosted</span>
              <span style={{ border: "1px solid rgba(245,247,240,0.25)", borderRadius: 999, padding: "6px 14px" }}>iOS</span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: nunito ? [{ name: "Nunito", data: nunito, weight: 800, style: "normal" }] : undefined,
    },
  );
}
