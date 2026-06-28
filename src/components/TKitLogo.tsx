interface TKitLogoProps {
  size?:      "sm" | "md" | "lg";
  gradient?:  string;
  color?:     string;
  transition?: boolean;
  subtitle?:  boolean;
}

const SIZES = {
  sm: { icon: 28, fontSize: 14, sub: 9,  gap: 7  },
  md: { icon: 36, fontSize: 18, sub: 11, gap: 9  },
  lg: { icon: 52, fontSize: 26, sub: 13, gap: 12 },
};

export default function TKitLogo({
  size = "md",
  color,
  transition = false,
  subtitle = false,
}: TKitLogoProps) {
  const s = SIZES[size];
  const trText = transition ? "color 0.7s ease" : undefined;

  // T-shape proportions (relative to icon size = 1 unit)
  const W = s.icon;          // total width of icon
  const H = Math.round(W * 1.18); // total height ~118% of width
  const barH = Math.round(H * 0.32);  // crossbar height
  const stemW = Math.round(W * 0.43); // stem width
  const stemX = Math.round((W - stemW) / 2); // stem x (centered)
  const accentSize = Math.round(barH * 0.68); // accent square size

  const dark   = color ?? "#3b2a1a";
  const accent = "#7c3a1e";

  return (
    <div className="flex items-center" style={{ gap: s.gap, lineHeight: 1 }}>
      {/* T-shape icon */}
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" style={{ flexShrink: 0 }}>
        {/* Crossbar */}
        <rect x={0} y={0} width={W} height={barH} rx={Math.round(barH * 0.18)} fill={dark} />
        {/* Stem */}
        <rect
          x={stemX} y={barH - 2}
          width={stemW} height={H - barH + 2}
          rx={Math.round(stemW * 0.12)}
          fill={dark}
        />
        {/* Accent square — bottom-left concave corner */}
        <rect
          x={1} y={barH}
          width={accentSize} height={accentSize}
          rx={Math.round(accentSize * 0.2)}
          fill={accent}
        />
      </svg>

      {/* Text block */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{
          fontFamily:    "var(--font-lora), Georgia, serif",
          fontWeight:    700,
          fontSize:      s.fontSize,
          color:         color ?? "var(--brown-dark)",
          letterSpacing: "-0.01em",
          lineHeight:    1,
          transition:    trText,
          userSelect:    "none",
        }}>
          T-Kit
        </span>
        {subtitle && (
          <span style={{
            fontFamily:    "var(--font-lora), Georgia, serif",
            fontWeight:    400,
            fontSize:      s.sub,
            color:         color ?? "var(--brown-light)",
            letterSpacing: "0.01em",
            lineHeight:    1.2,
            transition:    trText,
            userSelect:    "none",
          }}>
            платформа для репетиторов
          </span>
        )}
      </div>
    </div>
  );
}
