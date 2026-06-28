import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "T-Kit — платформа для репетиторов";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #fdf8f0 0%, #f0e6d3 100%)",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* Background pattern — subtle lines */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: "repeating-linear-gradient(to bottom, transparent 0px, transparent 39px, rgba(124,92,62,0.12) 39px, rgba(124,92,62,0.12) 40px)",
          display: "flex",
        }} />

        {/* Vertical accent line */}
        <div style={{
          position: "absolute", left: 80, top: 0, bottom: 0, width: 2,
          background: "rgba(176,120,90,0.25)", display: "flex",
        }} />

        {/* Content */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, zIndex: 1 }}>
          {/* Logo — T-shape icon */}
          <div style={{ display: "flex", position: "relative", width: 88, height: 104 }}>
            {/* Crossbar */}
            <div style={{
              position: "absolute", top: 0, left: 0,
              width: 88, height: 28,
              background: "#3b2a1a", borderRadius: 6,
            }} />
            {/* Stem */}
            <div style={{
              position: "absolute", top: 26, left: 24,
              width: 40, height: 78,
              background: "#3b2a1a", borderRadius: 5,
            }} />
            {/* Accent */}
            <div style={{
              position: "absolute", top: 28, left: 2,
              width: 20, height: 20,
              background: "#7c3a1e", borderRadius: 4,
            }} />
          </div>

          {/* Title */}
          <div style={{
            fontSize: 64, fontWeight: 800, color: "#3b2a1a",
            letterSpacing: -1, lineHeight: 1.1, textAlign: "center",
            fontFamily: "Georgia, serif",
          }}>
            T-Kit
          </div>

          {/* Subtitle */}
          <div style={{
            fontSize: 28, color: "#7c5c3e", textAlign: "center",
            fontFamily: "Arial, sans-serif", fontWeight: 400,
            maxWidth: 700, lineHeight: 1.4,
          }}>
            Платформа для репетиторов
          </div>

          {/* Features row */}
          <div style={{
            display: "flex", gap: 16, marginTop: 12,
          }}>
            {["📅 Расписание", "📝 Домашние задания", "🖊️ Интерактивная доска", "📚 Словарь"].map(f => (
              <div key={f} style={{
                padding: "10px 20px", borderRadius: 40,
                background: "rgba(124,92,62,0.10)",
                border: "1.5px solid rgba(124,92,62,0.20)",
                fontSize: 18, color: "#5a3e28",
                fontFamily: "Arial, sans-serif",
              }}>
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom domain */}
        <div style={{
          position: "absolute", bottom: 36,
          fontSize: 20, color: "rgba(124,92,62,0.5)",
          fontFamily: "Arial, sans-serif",
        }}>
          tkit.vercel.app
        </div>
      </div>
    ),
    { ...size }
  );
}
