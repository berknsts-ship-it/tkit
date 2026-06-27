export const THEMES = {
  default: {
    dark:         "#3b2a1a",
    mid:          "#7c5c3e",
    light:        "#b8956a",
    pale:         "#e8d5b7",
    bg:           "#fdf8f0",
    gradient:     "linear-gradient(135deg, #7c5c3e 0%, #b8956a 100%)",
    gradientSoft: "linear-gradient(135deg, #fdf8f0 0%, #f0e0c5 100%)",
    shadow:       "rgba(124, 92, 62, 0.35)",
    shadowCard:   "rgba(59, 42, 26, 0.07)",
    navBg:        "rgba(253, 248, 240, 0.97)",
    bgPattern:    "lines" as const,
    lineColor:    "rgba(180, 145, 90, 0.20)",
    marginColor:  "rgba(210, 130, 120, 0.22)",
  },
  warm: {
    dark:         "#5C3030",
    mid:          "#967878",
    light:        "#c8a0a0",
    pale:         "#F0CCB8",
    bg:           "#FDF0EB",
    gradient:     "linear-gradient(135deg, #967878 0%, #E08878 100%)",
    gradientSoft: "linear-gradient(135deg, #fdf0eb 0%, #f5d5c0 100%)",
    shadow:       "rgba(192, 96, 96, 0.30)",
    shadowCard:   "rgba(92, 48, 48, 0.07)",
    navBg:        "rgba(253, 240, 235, 0.97)",
    bgPattern:    "lines" as const,
    lineColor:    "rgba(224, 136, 120, 0.20)",
    marginColor:  "rgba(224, 136, 120, 0.28)",
  },
  cool: {
    dark:         "#2D3250",
    mid:          "#7B8DB0",
    light:        "#9baad0",
    pale:         "#C8D4E8",
    bg:           "#EEF2F8",
    gradient:     "linear-gradient(135deg, #3D3B5C 0%, #7B8DB0 100%)",
    gradientSoft: "linear-gradient(135deg, #eef2f8 0%, #d8e2f5 100%)",
    shadow:       "rgba(61, 59, 92, 0.30)",
    shadowCard:   "rgba(45, 50, 80, 0.07)",
    navBg:        "rgba(238, 242, 248, 0.97)",
    bgPattern:    "grid" as const,
    lineColor:    "rgba(123, 141, 176, 0.22)",
    marginColor:  "rgba(123, 141, 176, 0.22)",
  },
  humanities: {
    dark:         "#3D2D14",
    mid:          "#8A6A40",
    light:        "#b89060",
    pale:         "#E0CCA0",
    bg:           "#F5F0E4",
    gradient:     "linear-gradient(135deg, #5C3D18 0%, #A87840 100%)",
    gradientSoft: "linear-gradient(135deg, #f5f0e4 0%, #ecdfc0 100%)",
    shadow:       "rgba(92, 61, 24, 0.30)",
    shadowCard:   "rgba(61, 45, 20, 0.07)",
    navBg:        "rgba(245, 240, 228, 0.97)",
    bgPattern:    "lines" as const,
    lineColor:    "rgba(168, 120, 64, 0.20)",
    marginColor:  "rgba(168, 120, 64, 0.26)",
  },
} as const;

export type ThemeKey = keyof typeof THEMES;

export const SUBJECT_THEME: Record<string, ThemeKey> = {
  "Русский язык":              "warm",
  "Иностранный язык":          "warm",
  "Литература":                "warm",
  "Математика":                "cool",
  "Физика":                    "cool",
  "Химия":                     "cool",
  "Биология":                  "cool",
  "Информатика":               "cool",
  "История и обществознание":  "humanities",
  "Другое":                    "default",
};

export function getThemeKey(subject?: string | null): ThemeKey {
  if (!subject) return "default";
  return SUBJECT_THEME[subject] ?? "default";
}
