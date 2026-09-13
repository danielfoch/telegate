import { ImageResponse } from "next/og";

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

export default async function OpenGraphImage() {
  const nunito = await loadNunito();
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
            <div style={{ width: 56, height: 56, borderRadius: 16, background: "#0b1419", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(245,247,240,0.15)" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#adf28f" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" /><path d="M15 3h6v6M21 3l-7 7" stroke="#f5f7f0" /></svg>
            </div>
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
