"use client";

import {
  BookOpen, Globe, Languages, Feather, PenLine, Scroll,
  Calculator, Atom, FlaskConical, Microscope, Zap, Binary,
  Landmark, Map, Compass, GraduationCap, Star,
} from "lucide-react";
import type { ThemeKey } from "@/lib/themes";
import { THEMES } from "@/lib/themes";

const THEME_ICONS: Record<ThemeKey, React.ElementType[]> = {
  warm:       [BookOpen, Globe, Languages, Feather, PenLine, Scroll, BookOpen, Languages],
  cool:       [Calculator, Atom, FlaskConical, Microscope, Zap, Binary, Calculator, Atom],
  humanities: [Landmark, Map, Compass, Scroll, Globe, BookOpen, Landmark, Map],
  default:    [GraduationCap, BookOpen, Star, Feather, PenLine, GraduationCap, Star, BookOpen],
};

const ICON_POSITIONS = [
  { top: "5%",  left: "3%",   size: 72, opacity: 0.10, rotate: -18 },
  { top: "10%", right: "4%",  size: 56, opacity: 0.09, rotate:  22 },
  { top: "30%", left: "1%",   size: 48, opacity: 0.08, rotate:   8 },
  { top: "25%", right: "2%",  size: 80, opacity: 0.07, rotate: -12 },
  { top: "54%", left: "4%",   size: 60, opacity: 0.09, rotate:  14 },
  { top: "60%", right: "3%",  size: 50, opacity: 0.08, rotate: -22 },
  { top: "76%", left: "8%",   size: 44, opacity: 0.07, rotate:   5 },
  { top: "80%", right: "6%",  size: 64, opacity: 0.10, rotate:  -8 },
  { top: "90%", left: "28%",  size: 40, opacity: 0.06, rotate:  16 },
  { top: "3%",  left: "44%",  size: 52, opacity: 0.06, rotate:  -5 },
];

export default function TutorBackground({ themeKey }: { themeKey: ThemeKey }) {
  const t = THEMES[themeKey];
  const icons = THEME_ICONS[themeKey];

  const bgStyle = t.bgPattern === "grid" ? {
    backgroundImage: `
      linear-gradient(${t.bg} 0%, ${t.bg} 100%),
      repeating-linear-gradient(to right,  ${t.lineColor} 0px, ${t.lineColor} 1px, transparent 1px, transparent 28px),
      repeating-linear-gradient(to bottom, ${t.lineColor} 0px, ${t.lineColor} 1px, transparent 1px, transparent 28px)
    `,
    backgroundBlendMode: "normal",
  } : {
    backgroundImage: `
      repeating-linear-gradient(
        to bottom,
        transparent 0px, transparent 27px,
        ${t.lineColor} 27px, ${t.lineColor} 28px
      ),
      linear-gradient(
        to right,
        transparent 58px,
        ${t.marginColor} 58px, ${t.marginColor} 59.5px,
        transparent 59.5px
      )
    `,
    backgroundSize: "100% 28px, 100% 100%",
  };

  return (
    <div
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, backgroundColor: t.bg, ...bgStyle }}
      aria-hidden="true"
    >
      {ICON_POSITIONS.map((pos, i) => {
        const Icon = icons[i % icons.length];
        return (
          <div
            key={i}
            className="absolute"
            style={{
              top:       "top"   in pos ? pos.top   : undefined,
              left:      "left"  in pos ? pos.left  : undefined,
              right:     "right" in pos ? pos.right : undefined,
              transform: `rotate(${pos.rotate}deg)`,
              color:     t.mid,
              opacity:   pos.opacity,
            }}
          >
            <Icon size={pos.size} strokeWidth={1.4} />
          </div>
        );
      })}
    </div>
  );
}
