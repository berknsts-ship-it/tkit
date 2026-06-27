interface TKitLogoProps {
  size?:       "sm" | "md" | "lg";
  gradient?:   string;  // override CSS var, for themed pages
  color?:      string;  // Kit text color override
  transition?: boolean; // animate color changes (register page)
}

const SIZES = {
  sm: { box: 24, radius: 7,  fontSize: 13, gap: 6,  kit: "0.875rem" },
  md: { box: 30, radius: 9,  fontSize: 17, gap: 8,  kit: "1.1rem"   },
  lg: { box: 44, radius: 13, fontSize: 25, gap: 11, kit: "1.6rem"   },
};

export default function TKitLogo({
  size = "md",
  gradient,
  color,
  transition = false,
}: TKitLogoProps) {
  const s = SIZES[size];
  const tr = transition ? "background 0.7s ease, box-shadow 0.7s ease" : undefined;
  const trText = transition ? "color 0.7s ease" : undefined;

  return (
    <div className="flex items-center" style={{ gap: s.gap, lineHeight: 1 }}>
      {/* Бейдж с T */}
      <div
        style={{
          background:   gradient ?? "var(--gradient-primary)",
          width:        s.box,
          height:       s.box,
          borderRadius: s.radius,
          display:      "flex",
          alignItems:   "center",
          justifyContent: "center",
          boxShadow:    "0 2px 8px rgba(0,0,0,0.18)",
          flexShrink:   0,
          transition:   tr,
        }}
      >
        <span
          style={{
            color:      "white",
            fontFamily: "var(--font-lora), Georgia, serif",
            fontWeight: 700,
            fontSize:   s.fontSize,
            fontStyle:  "italic",
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          T
        </span>
      </div>

      {/* Kit */}
      <span
        style={{
          fontFamily:    "var(--font-lora), Georgia, serif",
          fontWeight:    600,
          fontSize:      s.kit,
          color:         color ?? "var(--brown-dark)",
          letterSpacing: "-0.01em",
          transition:    trText,
        }}
      >
        Kit
      </span>
    </div>
  );
}
