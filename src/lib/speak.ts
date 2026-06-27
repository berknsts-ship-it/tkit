export function speak(text: string, lang: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = lang;
  utter.rate = 0.85;
  window.speechSynthesis.speak(utter);
}

export const LANGUAGES: { code: string; label: string; flag: string }[] = [
  { code: "en-US", label: "Английский (США)",    flag: "🇺🇸" },
  { code: "en-GB", label: "Английский (UK)",      flag: "🇬🇧" },
  { code: "de-DE", label: "Немецкий",             flag: "🇩🇪" },
  { code: "fr-FR", label: "Французский",          flag: "🇫🇷" },
  { code: "es-ES", label: "Испанский",            flag: "🇪🇸" },
  { code: "it-IT", label: "Итальянский",          flag: "🇮🇹" },
  { code: "pt-PT", label: "Португальский",        flag: "🇵🇹" },
  { code: "zh-CN", label: "Китайский",            flag: "🇨🇳" },
  { code: "ja-JP", label: "Японский",             flag: "🇯🇵" },
  { code: "ko-KR", label: "Корейский",            flag: "🇰🇷" },
  { code: "ar-SA", label: "Арабский",             flag: "🇸🇦" },
  { code: "tr-TR", label: "Турецкий",             flag: "🇹🇷" },
  { code: "ru-RU", label: "Русский",              flag: "🇷🇺" },
];
