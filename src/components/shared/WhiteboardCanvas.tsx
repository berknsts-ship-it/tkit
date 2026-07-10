"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle, useMemo } from "react";
import { flushSync, createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { saveBoardState, loadBoardState } from "@/app/actions/board";
import {
  Pencil, Eraser, Trash2, Type, Highlighter, MousePointer2,
  BookOpen, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut,
  Maximize2, Hand, Navigation, Undo2, Redo2, Pointer, Lock, Unlock, ImagePlus, Link, FileText,
  Shapes, LayoutTemplate, Map as MapIcon, Minimize2, Magnet, Smile, Sparkles,
  ChevronsUp, ChevronsDown, ChevronUp, ChevronDown, LocateFixed, LockKeyhole, LockKeyholeOpen,
} from "lucide-react";

// ── types ─────────────────────────────────────────────────────────────────────
type Pt        = { x: number; y: number };
type TextAlign = "left" | "center" | "right";
type Ruling    = "none" | "lines" | "calligraphy" | "grid";
type RulingSize = "S" | "M" | "L";
type ShapeKind = "line" | "arrow" | "rect" | "circle" | "triangle" | "rhombus" | "star" | "pentagon" | "hexagon" | "parallelogram" | "cross";
type FrameShape = "rounded" | "rect" | "circle" | "diamond" | "hexagon" | "parallelogram";
type Tool      = "select" | "pen" | "eraser" | "text" | "highlight" | "laser" | "hand" | "image" | "shape" | "frame";

type PathItem = {
  type: "path"; id: string;
  points: Pt[]; color: string; size: number; eraser: boolean; highlight: boolean;
  opacity?: number;
  locked?: boolean; pdfPage?: number;
};
type TextItem = {
  type: "text"; id: string;
  x: number; y: number; text: string; font: string; color: string;
  fontSize: number; bold: boolean; italic: boolean; align: TextAlign;
  bgColor?: string; bgOpacity?: number; opacity?: number;
  locked?: boolean; pdfPage?: number; isSymbol?: boolean;
};
type FrameItem = {
  type: "frame"; id: string;
  x: number; y: number; w: number; h: number;
  shape: FrameShape;
  title: string;
  color: string;       // border colour
  bgColor: string;     // fill colour
  textColor?: string;
  fontSize?: number;
  borderWidth?: number;
  opacity?: number;
  private?: boolean;
  ownerStudentId?: string;
  ownerName?: string;
  ownerColor?: string;
  locked?: boolean; pdfPage?: number;
};
type ImageItem = {
  type: "image"; id: string;
  x: number; y: number; w: number; h: number; url: string;
  locked?: boolean; pdfPage?: number;
};
type ShapeItem = {
  type: "shape"; id: string;
  shape: ShapeKind; x1: number; y1: number; x2: number; y2: number;
  color: string; size: number; fill?: string;
  locked?: boolean; pdfPage?: number;
};
type VideoItem = {
  type: "video"; id: string;
  x: number; y: number; w: number; h: number;
  url: string;
  locked?: boolean; pdfPage?: number;
};
type DiceItem = {
  type: "dice"; id: string;
  x: number; y: number; w: number; h: number;
  count: number;
  result: number[];
  locked?: boolean; pdfPage?: number;
};
type WheelItem = {
  type: "wheel"; id: string;
  x: number; y: number; w: number; h: number;
  items: string[];
  angle: number;
  locked?: boolean; pdfPage?: number;
};
type TableItem = {
  type: "table"; id: string;
  x: number; y: number; w: number; h: number;
  rows: number; cols: number;
  data: string[][];   // [row][col]
  colWidths?: number[];
  fontSize?: number;
  headerRow?: boolean;
  locked?: boolean; pdfPage?: number;
};
type FunctionItem = {
  type: "function"; id: string;
  formula: string;
  color: string;
  lineWidth?: number;
  locked?: boolean;
  pdfPage?: number;
  // Box in world coordinates
  x: number; y: number; w: number; h: number;
  // Math viewport inside the box
  xMin: number; xMax: number; yMin: number; yMax: number;
};
type CardItem = {
  type: "card"; id: string;
  word: string; translation: string;
  hidden: boolean;
  x: number; y: number; w: number; h: number;
  rotation: number;
  locked?: boolean; pdfPage?: number;
};
type FormulaItem = {
  type: "formula"; id: string;
  x: number; y: number; w: number; h: number;
  latex: string; color: string; fontSize: number;
  locked?: boolean;
};
type CodeItem = {
  type: "code"; id: string;
  x: number; y: number; w: number; h: number;
  content: string; language: string;
  locked?: boolean;
};
type DrawItem = PathItem | TextItem | ImageItem | ShapeItem | FrameItem | VideoItem | DiceItem | WheelItem | TableItem | FunctionItem | CardItem | FormulaItem | CodeItem;

type WsEvent =
  | { type: "path-pt"; id: string; x: number; y: number; color: string; size: number; eraser: boolean; highlight: boolean }
  | { type: "path";    item: DrawItem }
  | { type: "update";  item: DrawItem }
  | { type: "clear" }
  | { type: "laser";   x: number; y: number }
  | { type: "cursor";  x: number; y: number }
  | { type: "viewport"; zoom: number; panX: number; panY: number }
  | { type: "pdf_page"; pdfUrl: string; pdfPage: number }
  | { type: "pdf_clear" }
  | { type: "ruling";  ruling: Ruling }
  | { type: "goto";     zoom: number; panX: number; panY: number }
  | { type: "lock_all"; locked: boolean }
  | { type: "video_sync"; id: string; action: "play" | "pause" | "seek"; position: number; sentAt: number }
  | { type: "privacy_mode"; enabled: boolean }
  | { type: "reveal_all" }
  | { type: "hide_all" };

// ── image cache ───────────────────────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement>();
function getCachedImage(url: string, onLoad: () => void): HTMLImageElement | null {
  if (imgCache.has(url)) return imgCache.get(url)!;
  const img = new Image();
  if (!url.startsWith("data:")) img.crossOrigin = "anonymous";
  img.onload = () => { imgCache.set(url, img); onLoad(); };
  img.onerror = () => {
    // CORS failed — retry without crossOrigin (for external URLs without CORS headers)
    const img2 = new Image();
    img2.onload = () => { imgCache.set(url, img2); onLoad(); };
    img2.src = url;
  };
  img.src = url;
  return null;
}

export interface BoardMaterial { id: string; title: string; file_url: string | null; file_name: string | null; }

export interface WhiteboardRef {
  getItems(): DrawItem[];
  loadItems(items: DrawItem[]): void;
  mergeItems(items: DrawItem[]): void;
}

// ── constants ─────────────────────────────────────────────────────────────────
const COLORS           = ["#1a1a1a","#e03030","#2060d0","#20a040","#d07020","#9030b0","#ffffff"];
const HIGHLIGHT_COLORS = ["#ffe400","#80ff60","#60e0ff","#ff80d0","#ffaa40"];
const SIZES            = [2, 5, 12, 24];
const FONTS = [
  { label: "Обычный",  family: "Arial, sans-serif" },
  { label: "Serif",    family: "'Times New Roman', serif" },
  { label: "Моно",     family: "'Courier New', monospace" },
  { label: "Рукопись", family: "Georgia, serif" },
];
const RULING_OPTIONS: { v: Ruling; title: string }[] = [
  { v: "none",        title: "Без разлиновки" },
  { v: "lines",       title: "Линейки" },
  { v: "calligraphy", title: "Каллиграфия" },
  { v: "grid",        title: "Клетка" },
];
function isPdf(n: string | null) { return n?.split(".").pop()?.toLowerCase() === "pdf"; }
function uid() { return Math.random().toString(36).slice(2, 10); }
const FRAME_COLORS = ["#4a80f0","#e05050","#20a060","#e08020","#8060d0","#d04090","#20a0a0","#806030"];

const SHAPE_KINDS: { v: ShapeKind; label: string; icon: string }[] = [
  { v: "line",          label: "Линия",            icon: "╱"  },
  { v: "arrow",         label: "Стрелка",          icon: "→"  },
  { v: "rect",          label: "Прямоугольник",    icon: "□"  },
  { v: "circle",        label: "Эллипс",           icon: "○"  },
  { v: "triangle",      label: "Треугольник",      icon: "△"  },
  { v: "rhombus",       label: "Ромб",             icon: "◇"  },
  { v: "star",          label: "Звезда",           icon: "★"  },
  { v: "pentagon",      label: "Пятиугольник",     icon: "⬠"  },
  { v: "hexagon",       label: "Шестиугольник",    icon: "⬡"  },
  { v: "parallelogram", label: "Параллелограмм",   icon: "▱"  },
  { v: "cross",         label: "Крест",            icon: "✚"  },
];
const FRAME_SHAPES: { v: FrameShape; label: string; icon: string }[] = [
  { v: "rounded",      label: "Прямоугольник", icon: "▢" },
  { v: "rect",         label: "Строгий rect",  icon: "□" },
  { v: "circle",       label: "Эллипс",        icon: "○" },
  { v: "diamond",      label: "Ромб",          icon: "◇" },
  { v: "hexagon",      label: "Шестиугольник", icon: "⬡" },
  { v: "parallelogram",label: "Параллелограмм",icon: "▱" },
];
const SYMBOLS: Record<string, string[]> = {
  "Математика":  ["±","×","÷","≠","≤","≥","≈","≡","√","∛","²","³","∑","∏","∫","∬","∂","∞","∝","‰","°","·","∣"],
  "Греческие":   ["α","β","γ","δ","ε","ζ","η","θ","ι","κ","λ","μ","ν","ξ","π","ρ","σ","τ","φ","χ","ψ","ω","Δ","Σ","Λ","Ω","Γ","Θ","Π","Φ"],
  "Стрелки":     ["→","←","↑","↓","↔","↕","⇒","⇐","⇔","↗","↘","↗","↖","⟶","⟵","⇌","⥂","↺","↻"],
  "Геометрия":   ["∠","∡","△","▲","▽","□","■","◇","◆","○","●","⊥","∥","∦","≅","∼","∾","⊙","⊕","⌀"],
  "Хим/Физ":     ["⇌","→","←","↔","ΔH","ΔG","ΔS","ΔU","ℏ","Å","∇","μ₀","ε₀","⊛","℃","℉","㎍","㎎","㎏","㎜","㎝","㎞","㎡","㎥"],
  "Дроби/Числа": ["½","⅓","⅔","¼","¾","⅛","⅜","⅝","⅞","⁰","¹","²","³","⁴","⁵","⁶","⁷","⁸","⁹","₀","₁","₂","₃","₄"],
  "Эмодзи":      ["😀","😊","😂","😍","🥳","😎","😅","🤔","😴","😭","🥺","😡","🤩","🙌","👍","👎","✋","🤝","👏","🎉","🎊","🏆","⭐","🔥","💡","❤️","💪","📚","📝","✏️","🖊️","📖","🔍","💬","🗣️","❓","❗","✅","❌","⚡","🌟","🎯","🔑","💎","🚀","🌈","🎵","🎶","⏰","📅"],
};

// emoji keyword search index (Russian + English tags)
const EMOJI_TAGS: Record<string, string> = {
  "👍":"хорошо лайк окей класс да супер молодец палец вверх good like ok thumb up",
  "👎":"плохо дизлайк нет палец вниз bad dislike thumb down",
  "❤️":"сердце любовь heart love",
  "✅":"галочка готово выполнено правильно check done correct yes",
  "🙌":"браво молодец hands praise bravo",
  "👏":"аплодисменты браво clap applause",
  "💡":"идея свет лампочка idea light bulb",
  "🚀":"ракета запуск rocket launch",
  "💯":"сто отлично hundred perfect",
  "🔥":"огонь горячо пламя fire hot flame",
  "🎉":"праздник вечеринка party celebrate",
  "🏆":"трофей победа кубок trophy win cup",
  "⭐":"звезда отлично star",
  "📌":"булавка закрепить pin",
  "📎":"скрепка paperclip clip",
  "✏️":"карандаш pencil",
  "📝":"записки заметки notes memo",
  "📚":"книги учёба books study",
  "📖":"книга читать book read",
  "🔍":"поиск лупа search magnify",
  "💬":"сообщение чат message chat",
  "❓":"вопрос question",
  "❗":"восклицание важно exclamation important",
  "✔️":"галочка верно check tick",
  "❌":"крест ошибка нет неверно cross error wrong no",
  "🎯":"цель попадание target goal dart",
  "🔑":"ключ key",
  "💎":"алмаз бриллиант diamond gem",
  "🌟":"звезда блестит star glow",
  "⏰":"будильник время alarm clock time",
  "📅":"календарь дата calendar date",
  "💻":"компьютер ноутбук computer laptop",
  "📱":"телефон смартфон phone smartphone",
  "📊":"график таблица chart bar",
  "📈":"рост график вверх chart up growth",
  "📉":"падение вниз график chart down",
  "🔒":"замок закрыто lock",
  "⚙️":"шестерёнка настройки gear settings",
  "😀":"улыбка счастье радость smile happy",
  "😊":"улыбка добро smile",
  "😂":"смех laugh funny lol",
  "😍":"влюблён сердечки love heart eyes",
  "🥳":"праздник ура party",
  "😎":"круто очки cool sunglasses",
  "😅":"нервный пот nervous sweat",
  "🤔":"думать размышлять think",
  "😴":"сон спать sleep tired",
  "😭":"плакать грустно cry sad",
  "🥺":"жалость умоляю please sad puppy",
  "😡":"злой гнев angry mad",
  "🤩":"восторг star eyes wow",
  "😈":"дьявол злодей devil evil",
  "💀":"череп смерть skull dead",
  "🤖":"робот robot",
  "🎃":"хэллоуин тыква halloween pumpkin",
  "👋":"привет пока рука wave hello bye",
  "✋":"стоп рука stop hand",
  "👌":"окей хорошо ok",
  "✌️":"победа два peace victory",
  "🤝":"рукопожатие договор handshake deal",
  "🙏":"прошу пожалуйста спасибо please thanks pray",
  "💪":"сила мышца strong muscle flex",
  "🐶":"собака пёс dog puppy",
  "🐱":"кот кошка cat",
  "🐭":"мышь mouse",
  "🐰":"кролик заяц rabbit bunny",
  "🐻":"медведь bear",
  "🐼":"панда panda",
  "🦊":"лиса fox",
  "🐯":"тигр tiger",
  "🦁":"лев lion",
  "🐮":"корова cow",
  "🐷":"свинья pig",
  "🐸":"лягушка frog",
  "🐵":"обезьяна monkey",
  "🐔":"курица chicken",
  "🐧":"пингвин penguin",
  "🦅":"орёл eagle",
  "🦉":"сова owl",
  "🐺":"волк wolf",
  "🦄":"единорог unicorn",
  "🐬":"дельфин dolphin",
  "🐳":"кит whale",
  "🦈":"акула shark",
  "🦋":"бабочка butterfly",
  "🐌":"улитка snail",
  "🐞":"божья коровка ladybug",
  "🍎":"яблоко apple",
  "🍊":"апельсин orange",
  "🍋":"лимон lemon",
  "🍇":"виноград grape",
  "🍓":"клубника strawberry",
  "🍉":"арбуз watermelon",
  "🍌":"банан banana",
  "🍕":"пицца pizza",
  "🍔":"гамбургер burger hamburger",
  "🍟":"картошка фри fries",
  "🍣":"суши sushi",
  "🍜":"лапша noodles",
  "☕":"кофе coffee",
  "🍵":"чай tea",
  "🍺":"пиво beer",
  "🍷":"вино wine",
  "🎂":"торт день рождения cake birthday",
  "🍰":"торт пирог cake pie",
  "🍫":"шоколад chocolate",
  "🍬":"конфета candy",
  "🍭":"леденец lollipop",
  "⚽":"футбол мяч football soccer ball",
  "🏀":"баскетбол basketball",
  "🎾":"теннис tennis",
  "🚴":"велосипед bike bicycle",
  "🏋️":"штанга gym weight",
  "🎮":"игры джойстик game controller",
  "🎲":"кубик игра dice game",
  "🎨":"рисование краски art paint",
  "🎭":"театр маска theater mask",
  "🎵":"музыка нота music note",
  "🎸":"гитара guitar",
  "🎹":"пианино piano",
  "🎺":"труба trumpet",
  "🥁":"барабан drum",
  "🌸":"цветок сакура flower sakura blossom",
  "🌹":"роза rose flower",
  "🌻":"подсолнух sunflower",
  "🌼":"ромашка daisy flower",
  "🌿":"трава листья grass leaf",
  "🍀":"клевер удача clover luck",
  "🍂":"осень листья autumn leaf",
  "❄️":"снег зима snow winter",
  "🌊":"волна море wave ocean sea",
  "🌈":"радуга rainbow",
  "☀️":"солнце sun",
  "🌙":"луна ночь moon night",
  "💧":"вода капля water drop",
  "🌴":"пальма palm tree",
  "🌵":"кактус cactus",
  "🏔️":"горы mountain",
  "🌋":"вулкан volcano",
  "📷":"камера фото camera photo",
  "🎥":"видео камера video camera",
  "💰":"деньги money",
  "💳":"карта card",
  "🔧":"инструмент гаечный ключ tool wrench",
  "💊":"таблетка лекарство pill medicine",
  "🏠":"дом home house",
  "🚗":"машина автомобиль car",
  "✈️":"самолёт полёт plane flight airplane",
  "🚂":"поезд train",
  "🎩":"шляпа hat",
  "📣":"громкоговоритель megaphone",
  "🔔":"звонок уведомление bell notification",
};

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: "Для работы", emojis: ["👍","👎","❤️","✅","🙌","🤲","➕","➖","👏","💡","🚀","💯","🔥","🎉","🏆","⭐","📌","📎","✏️","📝","📚","📖","🔍","💬","❓","❗","✔️","❌","⚡","🎯","🔑","💎","🌟","⏰","📅","💻","📱","🖥️","🖨️","⌨️","🖱️","📊","📈","📉","📋","🗒️","📁","📂","🗂️","💼","🔒","🔓","🔧","🔨","⚙️"] },
  { label: "Эмоции и люди", emojis: ["😀","😃","😄","😁","😆","😅","🤣","😂","🙂","🙃","😉","😊","😇","🥰","😍","🤩","😘","😗","😚","😋","😛","😝","😜","🤪","🤨","🧐","🤓","😎","🥸","🤩","🥳","😏","😒","😞","😔","😟","😕","🙁","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","🤯","😳","🥵","🥶","😱","😨","😰","😥","😓","🤗","🤔","🤭","🤫","🤥","😶","😐","😑","😬","🙄","😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤐","🥴","🤢","🤮","🤧","😷","🤒","🤕","🤑","🤠","😈","👿","👹","💀","👻","👽","🤖","💩","🎃"] },
  { label: "Жесты и люди", emojis: ["👋","🤚","🖐️","✋","🖖","👌","🤌","✌️","🤞","🤟","🤘","🤙","👈","👉","👆","🖕","👇","☝️","👍","👎","✊","👊","🤛","🤜","👏","🙌","🤲","🤝","🙏","✍️","💅","🤳","💪","🦾","🦵","🦶","👂","🦻","👃","🫀","🫁","🧠","🦷","🦴","👁️","👅","💋","🫦"] },
  { label: "Животные", emojis: ["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈","🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐗","🐴","🦄","🐝","🪱","🐛","🦋","🐌","🐞","🐜","🪲","🦟","🦗","🦂","🐢","🐍","🦎","🦖","🦕","🐙","🦑","🦐","🦞","🦀","🐡","🐠","🐟","🐬","🐳","🐋","🦈","🦭","🐊","🐅","🐆","🦓","🦍","🦧","🦣","🐘","🦛","🦏","🐪","🐫","🦒","🦘","🦬","🐃","🐂","🐄","🐎","🐖","🐏","🐑","🦙","🐐","🦌","🐕","🐩","🦮","🐈","🐓","🦃","🦤","🦚","🦜","🦩","🦢","🕊️","🐇","🦝","🦨","🦡","🦫","🦦","🦥","🐁","🐀","🐿️","🦔"] },
  { label: "Еда и напитки", emojis: ["🍎","🍊","🍋","🍇","🍓","🍉","🍌","🍑","🍒","🥭","🍍","🥥","🥝","🍅","🥑","🍆","🥦","🥬","🥒","🌶️","🧄","🧅","🥔","🍠","🌽","🥕","🫛","🥑","🫒","🥜","🌰","🍞","🥐","🥖","🥨","🧀","🍳","🥚","🧈","🥞","🧇","🥓","🥩","🍗","🍖","🌮","🌯","🥙","🧆","🥚","🍜","🍝","🍛","🍲","🍱","🥘","🍣","🍤","🍙","🍚","🍘","🍥","🧁","🍰","🎂","🍮","🍭","🍬","🍫","🍿","🍩","🍪","🌰","🍯","☕","🧃","🥤","🧋","🍵","🍺","🍻","🍷","🥂","🍸","🍹","🧉","🍾","🧊"] },
  { label: "Активность", emojis: ["⚽","🏀","🏈","⚾","🥎","🎾","🏐","🏉","🥏","🎱","🏓","🏸","🥅","⛳","🎣","🤿","🎽","🎿","🛷","🥌","🎯","🎱","🎮","🕹️","🎲","♟️","🧩","🎭","🎨","🖼️","🎰","🚵","🚴","🏋️","🤸","🤼","🤺","🥊","🥋","🛹","🛼","🤾","⛹️","🧗","🤽","🚣","🧘","🏇","🏄","🏂","⛷️","🤺","🥅"] },
  { label: "Природа", emojis: ["🌸","🌺","🌹","🌻","🌼","🌷","🌿","☘️","🍀","🎋","🍃","🍂","🍁","🌾","🍄","🌵","🌴","🌲","🌳","🌱","🪴","🪨","🪸","🌊","💧","💦","🔥","🌈","🌤️","⛅","🌥️","☁️","🌦️","🌧️","⛈️","🌩️","🌨️","❄️","☃️","⛄","🌬️","💨","🌪️","🌫️","🌂","☂️","☔","⛱️","⚡","🌟","✨","💫","🌙","☀️","🌝","🌞","🌛","⭐","🌠","🎑","🌄","🌅","🌃","🌆","🌇","🌉","🏔️","⛰️","🗻","🌋","🏕️","🏖️","🏜️","🏝️","🏞️"] },
  { label: "Предметы", emojis: ["⌚","📱","💻","⌨️","🖥️","🖨️","📡","📺","📷","📸","📹","🎥","📽️","🎞️","📞","☎️","📟","📠","📺","📻","🧭","⏱️","⏲️","⏰","⌛","⏳","📡","🔋","🔌","💡","🔦","🕯️","🪔","🧯","💰","💳","💎","⚖️","🧰","🔑","🗝️","🔐","🔒","🔓","🔨","🪓","⛏️","⚒️","🛠️","🗡️","⚔️","🛡️","🪚","🔧","🪛","🔩","⚙️","🗜️","🔗","🧲","🪜","🧪","🧫","🧬","🔬","🔭","📡","💉","🩸","💊","🩹","🩺","🩻","🚪","🪞","🛏️","🛁","🚿","🪥","🧴","🧷","🧹","🧺","🧻","🪣","🧼","🫧","🏮","🪄","🎩","🧲","🪗","🎻","🎸","🎺","🥁","🪘","🎷","🎹","🪈","📣","📢","🔔","🔕"] },
];


// ── geometry helpers ──────────────────────────────────────────────────────────
function pathBounds(item: PathItem) {
  const xs = item.points.map(p => p.x), ys = item.points.map(p => p.y);
  const pad = Math.max(item.size / 2 + 2, 4);
  return { x0: Math.min(...xs) - pad, y0: Math.min(...ys) - pad,
           x1: Math.max(...xs) + pad, y1: Math.max(...ys) + pad };
}
function measureTextItem(item: TextItem) {
  const cv = document.createElement("canvas").getContext("2d")!;
  cv.font = `${item.italic?"italic ":""}${item.bold?"bold ":""}${item.fontSize}px ${item.font}`;
  const lines = item.text.split("\n");
  const w = Math.max(40, ...lines.map(l => cv.measureText(l).width));
  return { w, h: lines.length * item.fontSize * 1.4 };
}
function textBounds(item: TextItem) {
  const { w, h } = measureTextItem(item);
  const x0 = item.align === "center" ? item.x - w / 2 : item.align === "right" ? item.x - w : item.x;
  return { x0, y0: item.y, x1: x0 + w, y1: item.y + h, w, h };
}
function itemBounds(item: DrawItem) {
  if (item.type === "image")   return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "shape")   return { x0: Math.min(item.x1, item.x2), y0: Math.min(item.y1, item.y2), x1: Math.max(item.x1, item.x2), y1: Math.max(item.y1, item.y2) };
  if (item.type === "frame")   return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "video")   return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "dice")    return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "wheel")   return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "table")    return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "function") return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "card")     return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "formula") return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  if (item.type === "code")    return { x0: item.x, y0: item.y, x1: item.x + item.w, y1: item.y + item.h };
  return item.type === "path" ? pathBounds(item) : textBounds(item as TextItem);
}
function hitTest(item: DrawItem, wx: number, wy: number): boolean {
  if (item.type === "function") return wx >= item.x && wx <= item.x + item.w && wy >= item.y && wy <= item.y + item.h;
  if (item.type === "shape") {
    // lines/arrows: hit within ~8px of the line
    if (item.shape === "line" || item.shape === "arrow") {
      const dx = item.x2 - item.x1, dy = item.y2 - item.y1;
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 1) return false;
      const t = Math.max(0, Math.min(1, ((wx - item.x1) * dx + (wy - item.y1) * dy) / (len * len)));
      const dist = Math.hypot(wx - (item.x1 + t * dx), wy - (item.y1 + t * dy));
      return dist <= 8;
    }
  }
  const { x0, y0, x1, y1 } = itemBounds(item);
  return wx >= x0 && wx <= x1 && wy >= y0 && wy <= y1;
}
function shiftItem(item: DrawItem, dx: number, dy: number): DrawItem {
  if (item.type === "path")    return { ...item, points: item.points.map(p => ({ x: p.x + dx, y: p.y + dy })) };
  if (item.type === "shape")   return { ...item, x1: item.x1 + dx, y1: item.y1 + dy, x2: item.x2 + dx, y2: item.y2 + dy };
  if (item.type === "image")   return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "frame")   return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "video")   return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "dice")    return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "wheel")   return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "table")    return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "function") return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "card")     return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "formula") return { ...item, x: item.x + dx, y: item.y + dy };
  if (item.type === "code")    return { ...item, x: item.x + dx, y: item.y + dy };
  const ti = item as TextItem;
  return { ...ti, x: ti.x + dx, y: ti.y + dy };
}

// ── canvas drawing ────────────────────────────────────────────────────────────
function drawGrid(ctx: CanvasRenderingContext2D, w: number, h: number, panX: number, panY: number, zoom: number) {
  const STEP = 40, step = STEP * zoom;
  if (step < 6) return;
  const sx = ((panX % step) + step) % step, sy = ((panY % step) + step) % step;
  const r  = Math.max(0.5, Math.min(1.5, zoom * 0.9));
  ctx.fillStyle = "rgba(160,160,200,0.25)";
  for (let x = sx - step; x < w + step; x += step)
    for (let y = sy - step; y < h + step; y += step) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
}
function drawRuling(ctx: CanvasRenderingContext2D, type: Ruling, w: number, h: number, zoom: number, panX: number, panY: number, sz: RulingSize = "M") {
  if (type === "none") return;

  const wL = -panX / zoom, wR = (w - panX) / zoom;
  const wT = -panY / zoom, wB = (h - panY) / zoom;

  if (type === "calligraphy") {
    // 4 guides per row: descender (dashed), baseline, x-height, cap line
    const LINE  = sz === "S" ? 60 : sz === "L" ? 120 : 80;
    const CAP   = LINE * 0.60;  // cap height above baseline
    const WAIST = LINE * 0.38;  // x-height above baseline
    const DESC  = LINE * 0.25;  // descender below baseline
    const SLANT = 55;
    ctx.save();
    const yStart = Math.floor(wT / LINE) * LINE - LINE;
    for (let y = yStart; y <= wB + LINE; y += LINE) {
      ctx.setLineDash([5/zoom, 5/zoom]);
      ctx.strokeStyle = "rgba(160,120,60,0.20)"; ctx.lineWidth = 0.7 / zoom;
      ctx.beginPath(); ctx.moveTo(wL, y + DESC); ctx.lineTo(wR, y + DESC); ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = "rgba(160,110,30,0.75)"; ctx.lineWidth = 1.0 / zoom;
      ctx.beginPath(); ctx.moveTo(wL, y); ctx.lineTo(wR, y); ctx.stroke();
      ctx.strokeStyle = "rgba(80,130,220,0.45)"; ctx.lineWidth = 0.8 / zoom;
      ctx.beginPath(); ctx.moveTo(wL, y - WAIST); ctx.lineTo(wR, y - WAIST); ctx.stroke();
      ctx.strokeStyle = "rgba(80,130,220,0.25)"; ctx.lineWidth = 0.7 / zoom;
      ctx.beginPath(); ctx.moveTo(wL, y - CAP); ctx.lineTo(wR, y - CAP); ctx.stroke();
    }
    const slantDx   = LINE * 0.45;
    const slantRise = slantDx / Math.tan((SLANT * Math.PI) / 180);
    const xStart    = Math.floor(wL / slantDx) * slantDx;
    ctx.strokeStyle = "rgba(160,110,30,0.10)"; ctx.lineWidth = 0.6 / zoom;
    for (let x = xStart; x <= wR + slantDx; x += slantDx) {
      ctx.beginPath(); ctx.moveTo(x, wB); ctx.lineTo(x + slantRise, wT); ctx.stroke();
    }
    ctx.restore();
    return;
  }

  const lineStep = sz === "S" ? 20 : sz === "L" ? 48 : 32;
  const gridStep = sz === "S" ? 20 : sz === "L" ? 60 : 36;
  const STEP = type === "lines" ? lineStep : gridStep;
  const sL = Math.floor(wL / STEP) * STEP - STEP, sR = Math.ceil(wR / STEP) * STEP + STEP;
  const sT = Math.floor(wT / STEP) * STEP - STEP, sB = Math.ceil(wB / STEP) * STEP + STEP;
  ctx.save(); ctx.strokeStyle = "rgba(100,130,220,0.3)"; ctx.lineWidth = 0.8 / zoom; ctx.beginPath();
  for (let y = sT; y <= sB; y += STEP) { ctx.moveTo(sL, y); ctx.lineTo(sR, y); }
  if (type === "grid")
    for (let x = sL; x <= sR; x += STEP) { ctx.moveTo(x, sT); ctx.lineTo(x, sB); }
  ctx.stroke(); ctx.restore();
}
function renderPath(ctx: CanvasRenderingContext2D, item: PathItem) {
  const pts = item.points;
  if (pts.length === 0) return;
  ctx.save();
  if (item.eraser)         { ctx.globalCompositeOperation = "destination-out"; }
  else if (item.highlight) { ctx.globalAlpha = 0.38; }
  else if (item.opacity !== undefined && item.opacity < 100) { ctx.globalAlpha = item.opacity / 100; }
  ctx.strokeStyle = item.color;
  ctx.lineWidth   = item.highlight ? Math.max(item.size, 20) : item.size;
  ctx.lineCap     = item.highlight ? "square" : "round";
  ctx.lineJoin    = "round";
  ctx.beginPath();
  if (pts.length === 1) {
    ctx.fillStyle = item.eraser ? "#000" : item.color;
    ctx.arc(pts[0].x, pts[0].y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, (pts[i].x + pts[i+1].x) / 2, (pts[i].y + pts[i+1].y) / 2);
    }
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  }
  ctx.restore();
}
function renderText(ctx: CanvasRenderingContext2D, item: TextItem) {
  ctx.save();
  if (item.opacity !== undefined && item.opacity < 100) ctx.globalAlpha = item.opacity / 100;
  const font = `${item.italic?"italic ":""}${item.bold?"bold ":""}${item.fontSize}px ${item.font}`;
  ctx.font = font; ctx.textBaseline = "top"; ctx.textAlign = item.align ?? "left";
  const lineH = item.fontSize * 1.4;
  const lines = item.text.split("\n");
  if (item.bgColor) {
    // Measure width for background
    let maxW = 0;
    for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
    const pad = item.fontSize * 0.25;
    const bg = item.bgColor;
    const bgAlpha = (item.bgOpacity ?? 100) / 100;
    ctx.save();
    ctx.globalAlpha *= bgAlpha;
    ctx.fillStyle = bg;
    const alignOff = item.align === "center" ? -maxW/2 : item.align === "right" ? -maxW : 0;
    ctx.fillRect(item.x + alignOff - pad, item.y - pad, maxW + pad*2, lines.length * lineH + pad*2);
    ctx.restore();
  }
  ctx.fillStyle = item.color;
  lines.forEach((line, i) => ctx.fillText(line, item.x, item.y + i * lineH));
  ctx.restore();
}
function frameShapePath(ctx: CanvasRenderingContext2D, item: FrameItem) {
  const { x, y, w, h, shape = "rounded" } = item;
  ctx.beginPath();
  if (shape === "rect") {
    ctx.rect(x, y, w, h);
  } else if (shape === "rounded") {
    const R = Math.min(14, w * 0.12, h * 0.12);
    ctx.moveTo(x + R, y); ctx.lineTo(x + w - R, y);
    ctx.arcTo(x + w, y, x + w, y + R, R);
    ctx.lineTo(x + w, y + h - R);
    ctx.arcTo(x + w, y + h, x + w - R, y + h, R);
    ctx.lineTo(x + R, y + h);
    ctx.arcTo(x, y + h, x, y + h - R, R);
    ctx.lineTo(x, y + R);
    ctx.arcTo(x, y, x + R, y, R);
    ctx.closePath();
  } else if (shape === "circle") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  } else if (shape === "diamond") {
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
  } else if (shape === "hexagon") {
    const cx = x + w / 2, cy = y + h / 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      const px = cx + (w / 2) * Math.cos(a), py = cy + (h / 2) * Math.sin(a);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
  } else if (shape === "parallelogram") {
    const off = w * 0.18;
    ctx.moveTo(x + off, y); ctx.lineTo(x + w, y);
    ctx.lineTo(x + w - off, y + h); ctx.lineTo(x, y + h);
    ctx.closePath();
  }
}
function renderFrame(ctx: CanvasRenderingContext2D, item: FrameItem, zoom = 1) {
  ctx.save();
  if (item.opacity !== undefined && item.opacity < 100) ctx.globalAlpha = item.opacity / 100;
  const bw = item.borderWidth ?? 2;
  const borderColor = item.color;
  ctx.fillStyle = item.bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = bw;
  frameShapePath(ctx, item);
  ctx.fill();
  ctx.stroke();

  if (item.ownerName) {
    const pad = 8 / zoom;
    const fs = Math.max(10 / zoom, Math.min(13 / zoom, item.h * 0.09));
    const r = fs * 0.72;
    const cx = item.x + pad + r;
    const cy = item.y + pad + r;
    // avatar circle
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = item.ownerColor ?? borderColor;
    ctx.globalAlpha = (item.opacity !== undefined && item.opacity < 100) ? (item.opacity / 100) : 1;
    ctx.fill();
    // initial letter
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${r * 1.1}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(item.ownerName[0].toUpperCase(), cx, cy);
    // name text
    ctx.fillStyle = item.ownerColor ?? borderColor;
    ctx.font = `bold ${fs}px sans-serif`;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(item.ownerName, item.x + pad + r * 2 + 4 / zoom, cy);
  }
  ctx.restore();
}
function renderPrivateFrame(ctx: CanvasRenderingContext2D, item: FrameItem, zoom: number) {
  ctx.save();
  ctx.filter = "blur(4px)";
  ctx.globalAlpha = 0.2;
  const bw = item.borderWidth ?? 2;
  ctx.fillStyle = item.bgColor;
  ctx.strokeStyle = item.color;
  ctx.lineWidth = bw;
  frameShapePath(ctx, item);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function renderImage(ctx: CanvasRenderingContext2D, item: ImageItem, onLoad: () => void) {
  const img = getCachedImage(item.url, onLoad);
  if (img) {
    try { ctx.drawImage(img, item.x, item.y, item.w, item.h); } catch { /* cross-origin taint — skip */ }
  } else {
    ctx.save();
    ctx.fillStyle = "#f0f0f0"; ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1 / (ctx.getTransform().a || 1);
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = "#999"; ctx.font = `14px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("⏳", item.x + item.w / 2, item.y + item.h / 2);
    ctx.restore();
  }
}
function renderShape(ctx: CanvasRenderingContext2D, item: ShapeItem) {
  const { x1, y1, x2, y2, color, size, fill, shape } = item;
  const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
  const w = x2 - x1, h = y2 - y1;
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = size; ctx.lineCap = "round"; ctx.lineJoin = "round";
  if (fill) ctx.fillStyle = fill;
  ctx.beginPath();
  if (shape === "line") {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  } else if (shape === "arrow") {
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const alen = Math.min(Math.max(size * 4, 14), 32);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - alen * Math.cos(angle - 0.4), y2 - alen * Math.sin(angle - 0.4));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - alen * Math.cos(angle + 0.4), y2 - alen * Math.sin(angle + 0.4));
    ctx.stroke();
  } else if (shape === "rect") {
    ctx.rect(x1, y1, w, h);
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "circle") {
    ctx.ellipse(cx, cy, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "triangle") {
    ctx.moveTo(cx, y1); ctx.lineTo(x2, y2); ctx.lineTo(x1, y2); ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "rhombus") {
    ctx.moveTo(cx, y1); ctx.lineTo(x2, cy); ctx.lineTo(cx, y2); ctx.lineTo(x1, cy); ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "star") {
    const outer = Math.min(Math.abs(w), Math.abs(h)) / 2;
    const inner = outer * 0.4;
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 === 0 ? outer : inner;
      if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "pentagon") {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
    for (let i = 0; i < 5; i++) {
      const a = (2 * Math.PI / 5) * i - Math.PI / 2;
      if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "hexagon") {
    const r = Math.min(Math.abs(w), Math.abs(h)) / 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i;
      if (i === 0) ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      else ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
    }
    ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "parallelogram") {
    const offset = Math.abs(w) * 0.2;
    ctx.moveTo(x1 + offset, y1); ctx.lineTo(x2, y1);
    ctx.lineTo(x2 - offset, y2); ctx.lineTo(x1, y2);
    ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  } else if (shape === "cross") {
    const t = Math.min(Math.abs(w), Math.abs(h)) * 0.3;
    ctx.moveTo(cx - t/2, y1); ctx.lineTo(cx + t/2, y1);
    ctx.lineTo(cx + t/2, cy - t/2); ctx.lineTo(x2, cy - t/2);
    ctx.lineTo(x2, cy + t/2); ctx.lineTo(cx + t/2, cy + t/2);
    ctx.lineTo(cx + t/2, y2); ctx.lineTo(cx - t/2, y2);
    ctx.lineTo(cx - t/2, cy + t/2); ctx.lineTo(x1, cy + t/2);
    ctx.lineTo(x1, cy - t/2); ctx.lineTo(cx - t/2, cy - t/2);
    ctx.closePath();
    if (fill) ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}
function renderFunction(ctx: CanvasRenderingContext2D, item: FunctionItem, zoom: number) {
  const { x, y, w, h, formula, color, lineWidth } = item;
  const xMin = item.xMin, xMax = item.xMax, yMin = item.yMin, yMax = item.yMax;

  // Math → box-local world coordinate transforms
  const bx = (mx: number) => (mx - xMin) / (xMax - xMin) * w;
  const by = (my: number) => (1 - (my - yMin) / (yMax - yMin)) * h;

  ctx.save();
  ctx.translate(x, y);

  // Background with subtle shadow
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.13)";
  ctx.shadowBlur = 8 / zoom;
  ctx.shadowOffsetY = 2 / zoom;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // Clip to box
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, w, h); ctx.clip();

  // Grid step (1 or 2 depending on range)
  const mathW = xMax - xMin;
  const step = mathW <= 14 ? 1 : mathW <= 28 ? 2 : 5;

  // Light grid lines
  ctx.strokeStyle = "#e8eaed";
  ctx.lineWidth = 0.5 / zoom;
  for (let mx = Math.ceil(xMin / step) * step; mx <= xMax + 1e-9; mx += step) {
    const bxv = bx(mx);
    ctx.beginPath(); ctx.moveTo(bxv, 0); ctx.lineTo(bxv, h); ctx.stroke();
  }
  for (let my = Math.ceil(yMin / step) * step; my <= yMax + 1e-9; my += step) {
    const byv = by(my);
    ctx.beginPath(); ctx.moveTo(0, byv); ctx.lineTo(w, byv); ctx.stroke();
  }

  // Axis positions (clamped to box edges if 0 is outside range)
  const axisY = Math.max(0, Math.min(h, by(0)));
  const axisX = Math.max(0, Math.min(w, bx(0)));

  // Axes
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1.5 / zoom;
  // X-axis
  ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(w, axisY); ctx.stroke();
  // Y-axis
  ctx.beginPath(); ctx.moveTo(axisX, h); ctx.lineTo(axisX, 0); ctx.stroke();

  // Axis arrows
  const aw = 5 / zoom, ah = 3 / zoom;
  ctx.fillStyle = "#374151";
  // → X
  ctx.beginPath(); ctx.moveTo(w, axisY); ctx.lineTo(w - aw, axisY - ah); ctx.lineTo(w - aw, axisY + ah); ctx.closePath(); ctx.fill();
  // ↑ Y
  ctx.beginPath(); ctx.moveTo(axisX, 0); ctx.lineTo(axisX - ah, aw); ctx.lineTo(axisX + ah, aw); ctx.closePath(); ctx.fill();

  // Axis labels x, y
  const fs = 9 / zoom;
  ctx.font = `italic ${fs}px "Times New Roman", serif`;
  ctx.fillStyle = "#374151";
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText("x", w - aw - fs * 0.2, axisY + fs * 0.1);
  ctx.textAlign = "left"; ctx.textBaseline = "bottom";
  ctx.fillText("y", axisX + fs * 0.4, fs * 0.8);

  // Tick marks and labels
  const tickLen = 3.5 / zoom;
  const numFs = fs * 0.9;
  ctx.font = `${numFs}px system-ui, sans-serif`;
  ctx.fillStyle = "#4b5563";
  ctx.lineWidth = 0.8 / zoom;
  ctx.strokeStyle = "#374151";

  // X ticks
  ctx.textAlign = "center";
  for (let mx = Math.ceil(xMin / step) * step; mx <= xMax + 1e-9; mx += step) {
    if (Math.abs(mx) < 1e-9) continue;
    const bxv = bx(mx);
    ctx.beginPath(); ctx.moveTo(bxv, axisY - tickLen); ctx.lineTo(bxv, axisY + tickLen); ctx.stroke();
    ctx.textBaseline = axisY < h / 2 ? "top" : "bottom";
    ctx.fillText(String(mx), bxv, axisY < h / 2 ? axisY + tickLen + 0.5 / zoom : axisY - tickLen - 0.5 / zoom);
  }
  // Y ticks
  ctx.textBaseline = "middle";
  for (let my = Math.ceil(yMin / step) * step; my <= yMax + 1e-9; my += step) {
    if (Math.abs(my) < 1e-9) continue;
    const byv = by(my);
    ctx.beginPath(); ctx.moveTo(axisX - tickLen, byv); ctx.lineTo(axisX + tickLen, byv); ctx.stroke();
    ctx.textAlign = axisX > w / 2 ? "right" : "left";
    const lx = axisX > w / 2 ? axisX - tickLen - 0.5 / zoom : axisX + tickLen + 0.5 / zoom;
    ctx.fillText(String(my), lx, byv);
  }
  // Origin "0"
  if (xMin < 0 && xMax > 0 && yMin < 0 && yMax > 0) {
    ctx.textAlign = "right"; ctx.textBaseline = "top"; ctx.fillStyle = "#9ca3af";
    ctx.fillText("0", axisX - 1.5 / zoom, axisY + 1.5 / zoom);
  }

  // The curve
  const fn = parseFormula(formula);
  if (fn) {
    ctx.strokeStyle = color;
    ctx.lineWidth = (lineWidth ?? 2) / zoom;
    ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath();
    const STEPS = 400;
    let started = false, prevMY = NaN;
    for (let i = 0; i <= STEPS; i++) {
      const mathX = xMin + (xMax - xMin) * (i / STEPS);
      let mathY: number;
      try { mathY = fn(mathX); } catch { started = false; continue; }
      if (!isFinite(mathY) || isNaN(mathY)) { started = false; prevMY = NaN; continue; }
      if (started && Math.abs(mathY - prevMY) > (yMax - yMin) * 3) { started = false; }
      const bxv = bx(mathX), byv = by(mathY);
      if (!started) { ctx.moveTo(bxv, byv); started = true; } else ctx.lineTo(bxv, byv);
      prevMY = mathY;
    }
    ctx.stroke();
  }

  ctx.restore(); // restore clip

  // Formula label (outside clip so it overlaps the border nicely)
  const lp = 5 / zoom, lfs = 10 / zoom;
  const labelText = `y = ${formula}`;
  ctx.font = `bold ${lfs}px system-ui, sans-serif`;
  const tw = ctx.measureText(labelText).width;
  ctx.fillStyle = "rgba(255,255,255,0.88)";
  ctx.fillRect(lp - 2 / zoom, lp - 1 / zoom, tw + 4 / zoom, lfs + 4 / zoom);
  ctx.fillStyle = color;
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.fillText(labelText, lp, lp);

  // Border
  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1 / zoom;
  ctx.strokeRect(0, 0, w, h);

  ctx.restore(); // restore translate
}

function drawLockBadge(ctx: CanvasRenderingContext2D, x: number, y: number, zoom: number) {
  const sz = Math.max(8, Math.min(18, 14 / zoom));
  ctx.save();
  ctx.fillStyle = "rgba(234,88,12,0.88)";
  ctx.beginPath(); ctx.rect(x, y, sz, sz); ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.font = `${sz * 0.78}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("🔒", x + sz / 2, y + sz / 2 + 0.5);
  ctx.restore();
}

function drawCard(ctx: CanvasRenderingContext2D, item: CardItem, zoom: number) {
  const { x, y, w, h, hidden, word, translation, rotation } = item;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(rotation * Math.PI / 180);
  const r = Math.min(10 / zoom, w / 4, h / 4);
  ctx.beginPath();
  ctx.moveTo(-w/2 + r, -h/2);
  ctx.lineTo(w/2 - r, -h/2); ctx.arcTo(w/2, -h/2, w/2, -h/2 + r, r);
  ctx.lineTo(w/2, h/2 - r);  ctx.arcTo(w/2, h/2, w/2 - r, h/2, r);
  ctx.lineTo(-w/2 + r, h/2); ctx.arcTo(-w/2, h/2, -w/2, h/2 - r, r);
  ctx.lineTo(-w/2, -h/2 + r); ctx.arcTo(-w/2, -h/2, -w/2 + r, -h/2, r);
  ctx.closePath();
  ctx.fillStyle = "white";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.12)";
  ctx.lineWidth = 1 / zoom;
  ctx.stroke();
  if (hidden) {
    ctx.fillStyle = "var(--brown-light, #b8956a)";
    ctx.font = `bold ${Math.round(22 / zoom)}px serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("✦", 0, 0);
  } else {
    const maxLen = 18;
    const wordTxt = word.length > maxLen ? word.slice(0, maxLen) + "…" : word;
    const transTxt = translation.length > maxLen ? translation.slice(0, maxLen) + "…" : translation;
    ctx.fillStyle = "#3b2a1a";
    ctx.font = `bold ${Math.round(11 / zoom)}px system-ui, sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(wordTxt, 0, -h * 0.18);
    ctx.strokeStyle = "rgba(0,0,0,0.1)"; ctx.lineWidth = 0.5 / zoom;
    ctx.beginPath(); ctx.moveTo(-w * 0.35, 0); ctx.lineTo(w * 0.35, 0); ctx.stroke();
    ctx.fillStyle = "#7c5c3e";
    ctx.font = `${Math.round(10 / zoom)}px system-ui, sans-serif`;
    ctx.fillText(transTxt, 0, h * 0.22);
  }
  // Speaker icon
  ctx.fillStyle = "rgba(180,149,106,0.7)";
  ctx.font = `${Math.round(9 / zoom)}px sans-serif`;
  ctx.textAlign = "right"; ctx.textBaseline = "bottom";
  ctx.fillText("🔊", w / 2 - 3 / zoom, h / 2 - 2 / zoom);
  ctx.restore();
}

function isCardSpeakerHit(card: CardItem, wx: number, wy: number): boolean {
  const cx = card.x + card.w / 2, cy = card.y + card.h / 2;
  const dx = wx - cx, dy = wy - cy;
  const rad = -card.rotation * Math.PI / 180;
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad);
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad);
  return lx > card.w / 2 - 28 && ly > card.h / 2 - 22;
}

function renderItem(ctx: CanvasRenderingContext2D, item: DrawItem, zoom: number, onLoad?: () => void) {
  if (item.type === "card") { drawCard(ctx, item as CardItem, zoom); if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom); return; }
  if (item.type === "path")    { renderPath(ctx, item); if (item.locked) { /* paths: no badge */ } return; }
  if (item.type === "image")   { renderImage(ctx, item, onLoad ?? (() => {})); if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom); return; }
  if (item.type === "shape")   { renderShape(ctx, item); if (item.locked) drawLockBadge(ctx, Math.max(item.x1,item.x2) - 14/zoom, Math.min(item.y1,item.y2) + 2/zoom, zoom); return; }
  if (item.type === "frame")   { renderFrame(ctx, item, zoom); if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom); return; }
  if (item.type === "function") { renderFunction(ctx, item, zoom); return; }
  if (item.type === "video") {
    ctx.save();
    ctx.fillStyle = "#111"; ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    const vcx = item.x + item.w/2, vcy = item.y + item.h/2, vr = Math.min(item.w, item.h) * 0.18;
    ctx.beginPath(); ctx.moveTo(vcx + vr, vcy); ctx.arc(vcx, vcy, vr, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom);
    return;
  }
  if (item.type === "dice" || item.type === "wheel") {
    ctx.save();
    ctx.strokeStyle = "#4a80f055"; ctx.lineWidth = 1;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.restore();
    if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom);
    return;
  }
  if (item.type === "table") {
    ctx.save();
    ctx.strokeStyle = "#4a80f055"; ctx.lineWidth = 1;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.restore();
    if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom);
    return;
  }
  if (item.type === "formula") {
    ctx.save();
    ctx.fillStyle = "rgba(237,233,254,0.9)";
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.strokeStyle = "#7c3aed"; ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = "#7c3aed";
    ctx.font = `bold ${Math.min(18/zoom, item.h * 0.5)}px sans-serif`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("∑", item.x + item.w / 2, item.y + item.h / 2);
    ctx.restore();
    if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom);
    return;
  }
  if (item.type === "code") {
    ctx.save();
    ctx.fillStyle = "rgba(220,252,231,0.9)";
    ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.strokeStyle = "#16a34a"; ctx.lineWidth = 1.5 / zoom;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = "#16a34a";
    ctx.font = `bold ${Math.min(14/zoom, item.h * 0.35)}px monospace`;
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("</>", item.x + item.w / 2, item.y + item.h / 2);
    ctx.restore();
    if (item.locked) drawLockBadge(ctx, item.x + item.w - 14/zoom - 2/zoom, item.y + 2/zoom, zoom);
    return;
  }
  renderText(ctx, item as TextItem);
}

// ── LaTeX / Code overlay helpers ──────────────────────────────────────────────
function FormulaRenderer({ latex, color, fontSize }: { latex: string; color: string; fontSize: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const w = window as unknown as { katex?: { render(l: string, e: HTMLElement, o: object): void } };
    if (w.katex) {
      try { w.katex.render(latex || "\\text{формула}", ref.current, { throwOnError: false, displayMode: true }); return; }
      catch { /* fall through */ }
    }
    ref.current.textContent = latex || "формула";
  }, [latex]);
  return <div ref={ref} style={{ color, fontSize: fontSize + "px", padding: "8px 12px", width: "100%", overflowX: "auto" }} />;
}
function CodeRenderer({ content, language }: { content: string; language: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    ref.current.textContent = content;
    const w = window as unknown as { hljs?: { highlightElement(e: HTMLElement): void } };
    if (w.hljs) { try { w.hljs.highlightElement(ref.current); } catch { /* ignore */ } }
  }, [content, language]);
  return (
    <pre style={{ margin: 0, width: "100%", height: "100%", overflow: "auto", background: "transparent" }}>
      <code ref={ref} className={`language-${language}`} style={{ fontSize: 13, fontFamily: "monospace" }}>{content}</code>
    </pre>
  );
}

// ── RulingIcon ────────────────────────────────────────────────────────────────
function RulingIcon({ v }: { v: Ruling }) {
  const s = 22, c = "currentColor", w = 0.8;
  if (v === "none") return <span className="text-base font-bold leading-none">—</span>;
  if (v === "lines") return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{[5,10,15,20].map(y=><line key={y} x1={1} y1={y} x2={s-1} y2={y} stroke={c} strokeWidth={w}/>)}</svg>;
  if (v === "calligraphy") return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><line x1={1} y1={14} x2={s-1} y2={14} stroke={c} strokeWidth={1.2}/><line x1={1} y1={9} x2={s-1} y2={9} stroke={c} strokeWidth={w*0.5}/><line x1={1} y1={4} x2={s-1} y2={4} stroke={c} strokeWidth={w*0.5}/><line x1={1} y1={20} x2={s-1} y2={20} stroke={c} strokeWidth={w*0.3} strokeDasharray="3,3"/></svg>;
  if (v === "grid") return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{[4,8,12,16,20].map(y=><line key={"h"+y} x1={1} y1={y} x2={s-1} y2={y} stroke={c} strokeWidth={w*0.8}/>)}{[4,8,12,16,20].map(x=><line key={"v"+x} x1={x} y1={1} x2={x} y2={s-1} stroke={c} strokeWidth={w*0.8}/>)}</svg>;
  return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>{[7,15].map(y=><line key={"h"+y} x1={1} y1={y} x2={s-1} y2={y} stroke={c} strokeWidth={w}/>)}{[7,15].map(x=><line key={"v"+x} x1={x} y1={1} x2={x} y2={s-1} stroke={c} strokeWidth={w}/>)}</svg>;
}

// ── minimap helpers ────────────────────────────────────────────────────────────
function getItemBounds(item: DrawItem): { x: number; y: number; w: number; h: number } | null {
  switch (item.type) {
    case "path": {
      const pts = item.points;
      if (!pts?.length) return null;
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      return { x, y, w: Math.max(Math.max(...xs) - x, 8), h: Math.max(Math.max(...ys) - y, 8) };
    }
    case "text": {
      const fs = item.fontSize ?? 18;
      const lines = item.text.split("\n").length;
      return { x: item.x - 20, y: item.y, w: Math.max(item.text.length * fs * 0.55, 60), h: lines * fs * 1.4 };
    }
    case "shape":
      return { x: Math.min(item.x1, item.x2), y: Math.min(item.y1, item.y2),
               w: Math.max(Math.abs(item.x2 - item.x1), 8), h: Math.max(Math.abs(item.y2 - item.y1), 8) };
    case "card":
    case "frame":
    case "function":
    case "image":
    case "video":
    case "dice":
    case "wheel":
    case "table": return { x: item.x, y: item.y, w: item.w, h: item.h };
    default: return null;
  }
}

// ── formula evaluator ─────────────────────────────────────────────────────────
function parseFormula(input: string): ((x: number) => number) | null {
  let expr = input
    .replace(/^[yY]\s*=\s*/, "").replace(/^f\([xX]\)\s*=\s*/, "")
    .replace(/\^/g,   "**").replace(/²/g, "**2").replace(/³/g, "**3")
    .replace(/\bsin\b/g, "Math.sin").replace(/\bcos\b/g, "Math.cos")
    .replace(/\btan\b/g, "Math.tan").replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\babs\b/g, "Math.abs").replace(/\bln\b/g, "Math.log")
    .replace(/\blog\b/g, "Math.log10").replace(/\bexp\b/g, "Math.exp")
    .replace(/\bpi\b|\bπ\b/g, "Math.PI").replace(/\be\b/g, "Math.E")
    .replace(/([0-9])([a-zA-Z(])/g, "$1*$2");
  try {
    // eslint-disable-next-line no-new-func
    const fn = new Function("x", `"use strict";try{return +(${expr});}catch(e){return NaN;}`) as (x: number) => number;
    fn(0);
    return fn;
  } catch { return null; }
}

// ── component ─────────────────────────────────────────────────────────────────
const WhiteboardCanvas = forwardRef<WhiteboardRef, { roomId: string; role?: "tutor" | "student"; materials?: BoardMaterial[]; currentStudentId?: string; students?: { id: string; name: string }[]; fullscreen?: boolean; subjectProfile?: string; boardBg?: string }>(
function WhiteboardCanvas({ roomId, role = "student", materials = [], currentStudentId, students = [], fullscreen = false, subjectProfile, boardBg }, ref) {

  const containerRef    = useRef<HTMLDivElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const minimapRef      = useRef<HTMLCanvasElement>(null);
  const minimapMapRef   = useRef<{ minX:number; minY:number; scale:number; offX:number; offY:number } | null>(null);
  const renderMinimapFnRef = useRef<() => void>(() => {});
  const pdfOffscreen    = useRef<HTMLCanvasElement | null>(null);
  const channelRef      = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const saveTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipSaveRef     = useRef(false);
  const roomIdRef       = useRef(roomId);
  const remoteViewportRef      = useRef<{ zoom: number; panX: number; panY: number } | null>(null);
  const viewportThrottleRef    = useRef(0);
  const skipViewportBroadcast  = useRef(false);
  const gotoAnimRef            = useRef<{ rafId: number } | null>(null);

  const privacyModeRef = useRef(false);
  const [privacyMode, setPrivacyMode] = useState(false);

  const itemsRef      = useRef<DrawItem[]>([]);
  const livePathRef   = useRef<PathItem | null>(null);
  const remotePathsRef= useRef<Map<string, PathItem>>(new Map());
  const viewRef       = useRef({ zoom: 1, panX: 0, panY: 0 });
  const initRuling: Ruling = boardBg === "grid" ? "grid" : boardBg === "lines" ? "lines" : "none";
  const rulingRef     = useRef<Ruling>(initRuling);
  const pdfPageRef    = useRef<number | null>(null); // null = no PDF active

  const [vpZoom,      setVpZoom]      = useState(100);
  const [ruling,      setRulingUI]    = useState<Ruling>(initRuling);
  const [rulingSize,  setRulingSize]  = useState<RulingSize>("M");
  const rulingSizeRef = useRef<RulingSize>("M");
  const [connected,   setConnected]   = useState(false);
  const [showMinimap,        setShowMinimap]        = useState(false);
  const [hasRemoteViewport,  setHasRemoteViewport]  = useState(false);
  const [snapGrid,    setSnapGrid]    = useState(false);
  const [fnFormula,   setFnFormula]   = useState("");
  const [fnError,     setFnError]     = useState(false);
  const [showFnPanel,      setShowFnPanel]      = useState(false);
  const [showFormulaPanel, setShowFormulaPanel] = useState(false);
  const [formulaInput,     setFormulaInput]     = useState("");
  const [showCodePanel,    setShowCodePanel]    = useState(false);
  const [codeInput,        setCodeInput]        = useState("");
  const [codeLang,         setCodeLang]         = useState("python");
  const showDotsRef = useRef(boardBg !== "blank");

  const profileHide = useMemo(() => {
    const p = subjectProfile ?? "other";
    if (p === "english")  return new Set(["formula", "code"]);
    if (p === "math" || p === "physics") return new Set(["card", "code"]);
    if (p === "cs")       return new Set(["card", "formula"]);
    return new Set<string>();
  }, [subjectProfile]);
  const [isMobile,    setIsMobile]    = useState(false);
  // video sync
  const videosRef         = useRef<Map<string, HTMLVideoElement>>(new Map());
  const videoSeekTimerRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [pendingVideoSync, setPendingVideoSync] = useState<Map<string, { position: number; sentAt: number }>>(new Map());

  // undo/redo
  type HistoryEntry =
    | { type: "add";    item: DrawItem }
    | { type: "remove"; item: DrawItem; idx: number }
    | { type: "update"; idx: number; prev: DrawItem; next: DrawItem }
    | { type: "clear";  saved: DrawItem[] };
  const undoStack = useRef<HistoryEntry[]>([]);
  const redoStack = useRef<HistoryEntry[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // panning
  const panning   = useRef(false);
  const panOrigin = useRef({ cx: 0, cy: 0, vx: 0, vy: 0 });
  const spaceRef  = useRef(false);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const pinchDist = useRef(0);
  const pinchMid  = useRef<Pt>({ x: 0, y: 0 });
  // inertia
  const inertiaRef = useRef<{ vx: number; vy: number; rafId: number } | null>(null);
  const lastPanPt  = useRef<{ cx: number; cy: number; t: number } | null>(null);
  // gesture disambiguation: pending draw that switches from pan to draw on drag
  const touchDrawPending = useRef<{ cx: number; cy: number; wx: number; wy: number } | null>(null);

  // select
  const [selectedId,  setSelectedId_]  = useState<string | null>(null);
  const [selectedIds, setSelectedIds_] = useState<ReadonlySet<string>>(new Set());
  const setSelectedId  = (v: string | null)          => { selectedIdRef.current = v;  setSelectedId_(v); };
  const setSelectedIds = (v: ReadonlySet<string> | ((p: ReadonlySet<string>) => ReadonlySet<string>)) => {
    if (typeof v === "function") {
      setSelectedIds_(p => { const n = v(p); selectedIdsRef.current = n; return n; });
    } else { selectedIdsRef.current = v; setSelectedIds_(v); }
  };
  const [,            setPanVer]       = useState(0);
  type SelDrag = { mode: "move";   id: string; wx0: number; wy0: number; origItem: DrawItem }
              | { mode: "resize"; id: string; wx0: number; wy0: number; origItem: DrawItem; origFontSize: number; origDiag: number }
              | { mode: "resize-img"; id: string; corner: "se"|"sw"|"ne"|"nw"; wx0: number; wy0: number; origItem: DrawItem }
              | { mode: "resize-frame"; id: string; corner: "se"|"sw"|"ne"|"nw"; wx0: number; wy0: number; origItem: DrawItem };
  const selDragRef   = useRef<SelDrag | null>(null);
  // multi-select box
  const selBoxRef    = useRef<{ wx1: number; wy1: number; wx2: number; wy2: number } | null>(null);
  const [selBoxVis,  setSelBoxVis]  = useState(false);
  // multi-item drag
  type MultiDrag = { wx0: number; wy0: number; origItems: Map<string, DrawItem> };
  const multiDragRef = useRef<MultiDrag | null>(null);
  // clipboard
  const clipboardRef = useRef<DrawItem[]>([]);
  const selectedIdRef = useRef<string | null>(null);
  const selectedIdsRef = useRef<ReadonlySet<string>>(new Set());
  // image crop
  const [cropId, setCropId] = useState<string | null>(null);
  const cropRef = useRef<{ ox: number; oy: number; ow: number; oh: number; sx: number; sy: number; ex: number; ey: number } | null>(null);
  const cropDragRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  // text
  const [textInput,  setTextInput]  = useState<{ wx: number; wy: number } | null>(null);
  const [textValue,  setTextValue]  = useState("");
  const [bold,       setBold]       = useState(false);
  const [italic,     setItalic]     = useState(false);
  const [align,      setAlign]      = useState<TextAlign>("left");
  const [,           setEditingId]  = useState<string | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const textRef      = useRef<HTMLTextAreaElement>(null);

  // tools & drawing
  const [tool,    setTool]    = useState<Tool>("select");
  const [color,   setColor]   = useState("#1a1a1a");
  const [hlColor, setHlColor] = useState("#ffe400");
  const [size,    setSize]    = useState(4);
  const [opacity, setOpacity] = useState(100);
  const [fontSize,setFontSize]= useState(20);
  const [fontIdx, setFontIdx] = useState(0);
  // text background
  const [textBgColor,   setTextBgColor]   = useState("#ffffff");
  const [textBgOpacity, setTextBgOpacity] = useState(0); // 0 = no bg
  const textOpacity = 100;
  // frame tool
  const [frameShape,       setFrameShape]       = useState<FrameShape>("rounded");
  const [frameColor,       setFrameColor]       = useState("#4a80f0");
  const [frameFill,        setFrameFill]        = useState("#e8f0ff");
  const [frameOpacity,     setFrameOpacity]     = useState(100);
  const [frameBorderWidth, setFrameBorderWidth] = useState(2);
  const [frameTextColor,   setFrameTextColor]   = useState("#1a1a1a");
  const [frameFontSize,    setFrameFontSize]    = useState(14);
  const [showFrameMenu,    setShowFrameMenu]    = useState(false);
  const liveFrameRef = useRef<{ wx1: number; wy1: number; wx2: number; wy2: number } | null>(null);


  // laser / cursor overlays
  const [laserPos,     setLaserPos]     = useState<Pt|null>(null);
  const [ownLaser,     setOwnLaser]     = useState<Pt|null>(null);
  const [remoteCursor, setRemoteCursor] = useState<Pt|null>(null);
  const laserTimer        = useRef<ReturnType<typeof setTimeout>|null>(null);
  const ownLaserTimer     = useRef<ReturnType<typeof setTimeout>|null>(null);
  const remoteCursorTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const cursorThrottle    = useRef(0);

  // pdf
  const [pdf,        setPdf]        = useState<{url:string;title:string;page:number;total:number}|null>(null);
  const [showPdfPick,setShowPdfPick]= useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const pdfMaterials = materials.filter(m => isPdf(m.file_name) && m.file_url);

  // image dialog
  const [imgDialog,    setImgDialog]    = useState(false);
  const [imgUrl,       setImgUrl]       = useState("");
  const [imgUploading, setImgUploading] = useState(false);
  const [aiLoading,   setAiLoading]   = useState(false);
  const aiInputRef = useRef<HTMLInputElement>(null);
  const [imgError,     setImgError]     = useState<string | null>(null);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number | null>(null);
  const [videoUploadError,    setVideoUploadError]    = useState<string | null>(null);

  // shape tool
  const [shapeKind,     setShapeKind]     = useState<ShapeKind>("rect");
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [shapeFill,     setShapeFill]     = useState(false);
  const liveShapeRef = useRef<{ wx1: number; wy1: number; wx2: number; wy2: number } | null>(null);

  // Refs that mirror drawing-style state so render() stays stable (no Realtime reconnects on toolbar clicks)
  const colorRef           = useRef(color);
  const sizeRef            = useRef(size);
  const shapeKindRef       = useRef(shapeKind);
  const shapeFillRef       = useRef(shapeFill);
  const frameShapeRef      = useRef(frameShape);
  const frameColorRef      = useRef(frameColor);
  const frameFillRef       = useRef(frameFill);
  const frameOpacityRef    = useRef(frameOpacity);
  const frameBorderWidthRef= useRef(frameBorderWidth);
  useEffect(() => {
    colorRef.current = color; sizeRef.current = size;
    shapeKindRef.current = shapeKind; shapeFillRef.current = shapeFill;
    frameShapeRef.current = frameShape; frameColorRef.current = frameColor;
    frameFillRef.current = frameFill; frameOpacityRef.current = frameOpacity;
    frameBorderWidthRef.current = frameBorderWidth;
  }, [color, size, shapeKind, shapeFill, frameShape, frameColor, frameFill, frameOpacity, frameBorderWidth]);

  // symbol picker
  const [showSymbols, setShowSymbols] = useState(false);
  const [symTab,      setSymTab]      = useState<string>("Математика");

  // dice
  const [diceResult, setDiceResult] = useState<number[]>([]);
  const [diceCount,  setDiceCount]  = useState(1);
  const [showDice,   setShowDice]   = useState(false);
  const [diceRolling, setDiceRolling] = useState(false);

  // wheel of fortune
  const [showWheel,   setShowWheel]   = useState(false);
  const [wheelItems,  setWheelItems]  = useState("Вариант 1\nВариант 2\nВариант 3\nВариант 4");
  const [wheelResult, setWheelResult] = useState<string | null>(null);
  const [wheelAngle,  setWheelAngle]  = useState(0);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const wheelCanvasRef = useRef<HTMLCanvasElement>(null);
  // board dice/wheel state
  const [editWheelId, setEditWheelId] = useState<string | null>(null);
  const [editWheelText, setEditWheelText] = useState("");
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const shapeMenuAnchorRef  = useRef<HTMLDivElement>(null);
  const frameMenuAnchorRef  = useRef<HTMLDivElement>(null);
  const moreToolsAnchorRef  = useRef<HTMLDivElement>(null);
  const sideMenuRef = useRef<HTMLDivElement | null>(null);
  const [shapeMenuPos,  setShapeMenuPos]  = useState<{ top: number; left: number } | null>(null);
  const [frameMenuPos,  setFrameMenuPos]  = useState<{ top: number; left: number } | null>(null);
  const [moreToolsPos,  setMoreToolsPos]  = useState<{ top?: number; bottom?: number; left: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [pendingSymbol, setPendingSymbol]   = useState<string | null>(null);
  const [pendingSymbolPos, setPendingSymbolPos] = useState<{ sx: number; sy: number } | null>(null);
  const [touchDragging, setTouchDragging] = useState(false);

  // vocab card panel
  type VocabTopic = { id: string; title: string; words: { id: string; word: string; translation: string }[] };
  const [showVocabPanel,    setShowVocabPanel]    = useState(false);
  const [vocabTopics,       setVocabTopics]       = useState<VocabTopic[]>([]);
  const [vocabTopicId,      setVocabTopicId]      = useState("");
  const [vocabSelWords,     setVocabSelWords]     = useState<Set<string>>(new Set());
  const [vocabFaceDown,     setVocabFaceDown]     = useState(true);
  const [vocabLoading,      setVocabLoading]      = useState(false);
  // flip animation overlay
  type FlipOverlay = { id: string; sx: number; sy: number; sw: number; sh: number; rotation: number; word: string; translation: string; fromHidden: boolean; instanceId: number };
  const [flipOverlay, setFlipOverlay] = useState<FlipOverlay | null>(null);

  // ── render ──────────────────────────────────────────────────────────────────
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const { zoom, panX, panY } = viewRef.current;
    const w = canvas.width, h = canvas.height;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    // Grid is drawn in physical pixels
    if (rulingRef.current === "none" && showDotsRef.current) drawGrid(ctx, w, h, panX * dpr, panY * dpr, zoom * dpr);
    // World-space drawing: scale by dpr so 1 world unit = 1 CSS pixel
    ctx.save(); ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, panX * dpr, panY * dpr);
    drawRuling(ctx, rulingRef.current, w / dpr, h / dpr, zoom, panX, panY, rulingSizeRef.current);
    if (pdfOffscreen.current) ctx.drawImage(pdfOffscreen.current, 0, 0);
    for (const item of itemsRef.current) {
      if (item.id === editingIdRef.current) continue;
      const itemPage = (item as { pdfPage?: number }).pdfPage;
      if (itemPage !== undefined && pdfPageRef.current !== null && itemPage !== pdfPageRef.current) continue;
      if (
        item.type === "frame" && item.private &&
        role !== "tutor" &&
        item.ownerStudentId !== currentStudentId &&
        privacyModeRef.current
      ) {
        renderPrivateFrame(ctx, item, zoom);
        continue;
      }
      renderItem(ctx, item, zoom, render);
    }
    if (livePathRef.current) renderPath(ctx, livePathRef.current);
    for (const [, rp] of remotePathsRef.current) renderPath(ctx, rp);
    // live shape preview while dragging
    if (liveShapeRef.current) {
      const ls = liveShapeRef.current;
      renderShape(ctx, {
        type: "shape", id: "__live__", shape: shapeKindRef.current,
        x1: ls.wx1, y1: ls.wy1, x2: ls.wx2, y2: ls.wy2,
        color: colorRef.current, size: sizeRef.current,
        fill: shapeFillRef.current ? colorRef.current + "33" : undefined,
      });
    }
    if (liveFrameRef.current) {
      const lf = liveFrameRef.current;
      const fw = lf.wx2 - lf.wx1, fh = lf.wy2 - lf.wy1;
      if (Math.abs(fw) > 4 && Math.abs(fh) > 4) {
        renderFrame(ctx, {
          type:"frame", id:"__live__",
          x: Math.min(lf.wx1,lf.wx2), y: Math.min(lf.wy1,lf.wy2),
          w: Math.abs(fw), h: Math.abs(fh),
          shape: frameShapeRef.current, title: "",
          color: frameColorRef.current, bgColor: frameFillRef.current,
          opacity: frameOpacityRef.current, borderWidth: frameBorderWidthRef.current,
        }, zoom);
      }
    }
    ctx.restore();
    renderMinimapFnRef.current();
    if (role === "tutor" && !skipSaveRef.current) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveBoardState(roomIdRef.current, itemsRef.current);
      }, 1500);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── board persistence: keep roomIdRef in sync ────────────────────────────────
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  useEffect(() => {
    return () => {
      if (gotoAnimRef.current) cancelAnimationFrame(gotoAnimRef.current.rafId);
      if (inertiaRef.current)  cancelAnimationFrame(inertiaRef.current.rafId);
    };
  }, []);

  // ── board persistence: load on mount / student switch ────────────────────────
  useEffect(() => {
    itemsRef.current = [];
    remotePathsRef.current.clear();
    render();
    let cancelled = false;
    loadBoardState(roomId).then(items => {
      if (cancelled || !items.length) return;
      itemsRef.current = items as DrawItem[];
      render();
    });
    return () => {
      cancelled = true;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // ── touch: block passive scroll/zoom on the canvas container ────────────────
  // React 17+ registers synthetic onTouch* as passive, so e.preventDefault() inside
  // them is silently ignored. We attach non-passive native listeners purely to call
  // preventDefault() so the browser never starts a scroll/zoom gesture.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const prevent = (e: TouchEvent) => {
      if ((e.target as HTMLElement).closest?.("video")) return;
      if ((e.target as HTMLElement).closest?.("[data-no-prevent]")) return;
      e.preventDefault();
    };
    el.addEventListener("touchstart", prevent, { passive: false });
    el.addEventListener("touchmove",  prevent, { passive: false });
    return () => {
      el.removeEventListener("touchstart", prevent);
      el.removeEventListener("touchmove",  prevent);
    };
  }, []);

  // ── mobile detection ─────────────────────────────────────────────────────────
  useEffect(() => {
    // Touch devices under 1024px (phones + tablets) use bottom sheet for text input.
    // Tablets at ≥640px still see the desktop sidebar/toolbar layout via CSS,
    // but text editing goes through the keyboard-friendly bottom sheet.
    const check = () => setIsMobile(
      (navigator.maxTouchPoints > 0 || 'ontouchstart' in window) && window.innerWidth < 1024
    );
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // ── resize textarea when font size changes (A+/A- buttons) ──────────────────
  useEffect(() => {
    const ta = textRef.current;
    if (!ta || !textInput) return;
    ta.style.height = "auto";
    ta.style.height = ta.scrollHeight + "px";
  }, [fontSize, textInput]);

  // ── resize observer — DPR-aware canvas sizing ────────────────────────────────
  useEffect(() => {
    const c = containerRef.current, cv = canvasRef.current;
    if (!c || !cv) return;
    const setSize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = c.offsetWidth, h = c.offsetHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width  = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
        cv.style.width  = w + "px";
        cv.style.height = h + "px";
      }
      render();
    };
    const obs = new ResizeObserver(setSize);
    obs.observe(c); setSize();
    return () => obs.disconnect();
  }, [render]);

  // ── view helpers ─────────────────────────────────────────────────────────────
  const applyView = useCallback((zoom: number, panX: number, panY: number) => {
    viewRef.current = { zoom, panX, panY };
    setVpZoom(Math.round(zoom * 100)); setPanVer(v => v + 1); render();
    // Student broadcasts viewport so tutor can track position on minimap
    if (role === "student" && !skipViewportBroadcast.current) {
      const now = Date.now();
      if (now - viewportThrottleRef.current > 120) {
        viewportThrottleRef.current = now;
        channelRef.current?.send({ type: "broadcast", event: "draw", payload: { type: "viewport", zoom, panX, panY } });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [render]);

  // smooth-animate to target viewport (used when receiving goto event)
  const animateGoto = useCallback((tZoom: number, tPanX: number, tPanY: number) => {
    if (gotoAnimRef.current) cancelAnimationFrame(gotoAnimRef.current.rafId);
    const { zoom: fz, panX: fx, panY: fy } = viewRef.current;
    const DURATION = 380;
    const t0 = performance.now();
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DURATION);
      const e = 1 - Math.pow(1 - p, 3); // ease-out cubic
      skipViewportBroadcast.current = true;
      try { applyView(fz + (tZoom - fz) * e, fx + (tPanX - fx) * e, fy + (tPanY - fy) * e); }
      finally { skipViewportBroadcast.current = false; }
      if (p < 1) gotoAnimRef.current = { rafId: requestAnimationFrame(step) };
      else gotoAnimRef.current = null;
    };
    gotoAnimRef.current = { rafId: requestAnimationFrame(step) };
  }, [applyView]);

  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const { zoom, panX, panY } = viewRef.current;
    const nz = Math.max(0.05, Math.min(20, zoom * factor));
    applyView(nz, cx - (cx - panX) * (nz / zoom), cy - (cy - panY) * (nz / zoom));
  }, [applyView]);

  const zoomCenter = useCallback((f: number) => {
    const c = canvasRef.current; if (!c) return;
    zoomAt(c.width / 2, c.height / 2, f);
  }, [zoomAt]);

  const setRuling = (r: Ruling) => {
    rulingRef.current = r; setRulingUI(r);
    render();
    if (role === "tutor") send({ type: "ruling", ruling: r });
  };
  const setSzRuling = (sz: RulingSize) => {
    rulingSizeRef.current = sz; setRulingSize(sz); render();
  };

  // ── screen ↔ world ───────────────────────────────────────────────────────────
  const s2w = useCallback((sx: number, sy: number) => {
    const { zoom, panX, panY } = viewRef.current;
    return { x: (sx - panX) / zoom, y: (sy - panY) / zoom };
  }, []);
  const w2s = useCallback((wx: number, wy: number) => {
    const { zoom, panX, panY } = viewRef.current;
    return { x: wx * zoom + panX, y: wy * zoom + panY };
  }, []);
  const clientXY = (e: React.MouseEvent | React.TouchEvent, ti = 0) => {
    const r = containerRef.current!.getBoundingClientRect();
    if ("touches" in e) return { cx: e.touches[ti].clientX - r.left, cy: e.touches[ti].clientY - r.top };
    return { cx: (e as React.MouseEvent).clientX - r.left, cy: (e as React.MouseEvent).clientY - r.top };
  };
  const snapPt = (wx: number, wy: number): { x: number; y: number } => {
    if (!snapGrid) return { x: wx, y: wy };
    const { zoom } = viewRef.current;
    const rawStep = (window.innerWidth / zoom) / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(rawStep, 0.01))));
    const step = ([1, 2, 5, 10].find(n => n * mag >= rawStep) ?? 10) * mag / 5;
    return { x: Math.round(wx / step) * step, y: Math.round(wy / step) * step };
  };

  // ── wheel — trackpad pan / pinch-zoom / mouse wheel zoom ────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const h = (e: WheelEvent) => {
      // Let overlay panels (emoji picker, etc.) scroll naturally
      if ((e.target as Element).closest("[data-no-canvas-wheel]")) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch (OS sets ctrlKey) or Ctrl+scroll = zoom
        // deltaY is typically -3..3 for pinch, larger for mouse
        const factor = Math.exp(-e.deltaY * 0.008);
        const clamped = Math.max(0.7, Math.min(1.4, factor));
        zoomAt(cx, cy, clamped);
      } else {
        // Trackpad two-finger swipe = pan; mouse wheel = zoom
        const isTrackpad = e.deltaMode === 0 && Math.abs(e.deltaY) < 50 && !e.shiftKey;
        if (isTrackpad) {
          // Cancel any running inertia
          if (inertiaRef.current) { cancelAnimationFrame(inertiaRef.current.rafId); inertiaRef.current = null; }
          const { zoom, panX, panY } = viewRef.current;
          applyView(zoom, panX - e.deltaX, panY - e.deltaY);
        } else {
          // Mouse wheel = zoom at cursor
          const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
          zoomAt(cx, cy, factor);
        }
      }
    };
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  }, [zoomAt, applyView]);

  // ── keyboard ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

      if (e.code === "Space" && !e.repeat && !inInput)
        { e.preventDefault(); spaceRef.current = true; setSpaceHeld(true); }

      if ((e.ctrlKey||e.metaKey) && e.key === "z" && !e.shiftKey && !inInput)
        { e.preventDefault(); undo(); }
      if ((e.ctrlKey||e.metaKey) && (e.key === "y" || (e.key==="z"&&e.shiftKey)) && !inInput)
        { e.preventDefault(); redo(); }

      // Copy
      if ((e.ctrlKey||e.metaKey) && e.key === "c" && !inInput) {
        e.preventDefault();
        const sel = itemsRef.current.filter(i => i.id === selectedIdRef.current || selectedIdsRef.current.has(i.id));
        if (sel.length > 0) clipboardRef.current = sel.map(i => ({ ...i }));
      }
      // Paste
      if ((e.ctrlKey||e.metaKey) && e.key === "v" && !inInput) {
        e.preventDefault();
        if (clipboardRef.current.length === 0) return;
        const OFFSET = 24;
        const pasted = clipboardRef.current.map(i => ({ ...i, id: uid(), x: (i as ImageItem).x + OFFSET, y: (i as ImageItem).y + OFFSET } as DrawItem));
        pasted.forEach(item => { itemsRef.current.push(item); send({ type:"path", item }); pushHistory({ type:"add", item }); });
        render();
      }
      // Duplicate
      if ((e.ctrlKey||e.metaKey) && e.key === "d" && !inInput) {
        e.preventDefault();
        const sel = itemsRef.current.filter(i => i.id === selectedIdRef.current || selectedIdsRef.current.has(i.id));
        if (sel.length === 0) return;
        const OFFSET = 24;
        const duped = sel.map(i => shiftItem({ ...i, id: uid() }, OFFSET, OFFSET));
        duped.forEach(item => { itemsRef.current.push(item); send({ type:"path", item }); pushHistory({ type:"add", item }); });
        render();
      }

      // Delete / Backspace — remove selected item(s)
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        e.preventDefault();
        setSelectedIds(ids => {
          if (ids.size === 0) return ids;
          pushHistory({ type: "clear", saved: [...itemsRef.current] });
          const toRemove = ids;
          itemsRef.current = itemsRef.current.filter(i => !toRemove.has(i.id));
          render();
          // Broadcast: clear + re-send remaining
          send({ type: "clear" });
          itemsRef.current.forEach(item => send({ type: "path", item }));
          setSelectedId(null);
          return new Set();
        });
      }

      // Arrow keys — pan board (or nudge selected items)
      if (["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key) && !inInput) {
        e.preventDefault();
        const STEP = e.shiftKey ? 80 : 20;
        const panDx = e.key==="ArrowLeft" ? STEP : e.key==="ArrowRight" ? -STEP : 0;
        const panDy = e.key==="ArrowUp"   ? STEP : e.key==="ArrowDown"  ? -STEP : 0;
        setSelectedIds(ids => {
          if (ids.size > 0) {
            const nudge = STEP / viewRef.current.zoom;
            const wx = e.key==="ArrowLeft" ? -nudge : e.key==="ArrowRight" ? nudge : 0;
            const wy = e.key==="ArrowUp"   ? -nudge : e.key==="ArrowDown"  ? nudge : 0;
            for (const id of ids) {
              const idx = itemsRef.current.findIndex(i => i.id === id);
              if (idx >= 0) {
                const next = shiftItem(itemsRef.current[idx], wx, wy);
                itemsRef.current[idx] = next;
                send({ type:"update", item: next });
              }
            }
            render(); return ids;
          }
          const { zoom, panX, panY } = viewRef.current;
          applyView(zoom, panX + panDx, panY + panDy);
          return ids;
        });
      }
    };
    const ku = (e: KeyboardEvent) => { if (e.code==="Space") { spaceRef.current=false; setSpaceHeld(false); } };
    window.addEventListener("keydown", kd); window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PDF ──────────────────────────────────────────────────────────────────────
  const renderPdfPage = useCallback(async (url: string, pageNum: number) => {
    setPdfLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjsLib.getDocument({ url }).promise;
      const page = await doc.getPage(pageNum);
      const vp0 = page.getViewport({ scale: 1 });
      const scale = Math.min(1600 / vp0.width, 900 / vp0.height);
      const vpPdf = page.getViewport({ scale });
      const tmp = document.createElement("canvas");
      tmp.width = Math.round(vpPdf.width); tmp.height = Math.round(vpPdf.height);
      await page.render({ canvas: tmp, viewport: vpPdf }).promise;
      pdfOffscreen.current = tmp; render();
      return doc.numPages;
    } finally { setPdfLoading(false); }
  }, [render]);

  const loadPdfPage = useCallback(async (url: string, title: string, pageNum: number, total?: number) => {
    const n = await renderPdfPage(url, pageNum);
    pdfPageRef.current = pageNum;
    setPdf({ url, title, page: pageNum, total: total ?? n });
  }, [renderPdfPage]);

  const goPage = async (delta: number) => {
    if (!pdf) return;
    const next = Math.max(1, Math.min(pdf.total, pdf.page + delta));
    if (next === pdf.page) return;
    await loadPdfPage(pdf.url, pdf.title, next, pdf.total);
    send({ type: "pdf_page", pdfUrl: pdf.url, pdfPage: next });
  };
  const closePdf = () => {
    pdfOffscreen.current = null; pdfPageRef.current = null;
    render(); setPdf(null); send({ type: "pdf_clear" });
  };

  // ── Realtime ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    const handler = ({ payload }: { payload: WsEvent }) => {
      if (payload.type === "clear")     { itemsRef.current = []; remotePathsRef.current.clear(); render(); return; }
      if (payload.type === "pdf_clear") { pdfOffscreen.current = null; render(); setPdf(null); return; }
      if (payload.type === "pdf_page")  { loadPdfPage(payload.pdfUrl, "", payload.pdfPage); return; }
      if (payload.type === "viewport") {
        remoteViewportRef.current = { zoom: payload.zoom, panX: payload.panX, panY: payload.panY };
        if (role === "student") {
          skipViewportBroadcast.current = true;
          try { applyView(payload.zoom, payload.panX, payload.panY); }
          finally { skipViewportBroadcast.current = false; }
        } else {
          setHasRemoteViewport(true);
          renderMinimapFnRef.current?.();
        }
        return;
      }
      if (payload.type === "goto") {
        remoteViewportRef.current = { zoom: payload.zoom, panX: payload.panX, panY: payload.panY };
        animateGoto(payload.zoom, payload.panX, payload.panY);
        return;
      }
      if (payload.type === "ruling")    { setRuling(payload.ruling); return; }
      if (payload.type === "laser") {
        setLaserPos({ x: payload.x, y: payload.y });
        if (laserTimer.current) clearTimeout(laserTimer.current);
        laserTimer.current = setTimeout(() => setLaserPos(null), 2500); return;
      }
      if (payload.type === "cursor") {
        setRemoteCursor({ x: payload.x, y: payload.y });
        if (remoteCursorTimer.current) clearTimeout(remoteCursorTimer.current);
        remoteCursorTimer.current = setTimeout(() => setRemoteCursor(null), 3000); return;
      }
      if (payload.type === "path-pt") {
        const { id, x, y, color, size, eraser, highlight } = payload;
        const existing = remotePathsRef.current.get(id);
        if (existing) { existing.points.push({ x, y }); }
        else { remotePathsRef.current.set(id, { type:"path", id, points:[{x,y}], color, size, eraser, highlight }); }
        skipSaveRef.current = true; render(); skipSaveRef.current = false;
        return;
      }
      if (payload.type === "path") {
        if (payload.item.type === "image") console.log("[board] received image item", payload.item.id, "url-len:", (payload.item as {url:string}).url?.length ?? 0);
        remotePathsRef.current.delete(payload.item.id);
        itemsRef.current.push(payload.item); render(); return;
      }
      if (payload.type === "update") {
        const idx = itemsRef.current.findIndex(it => it.id === payload.item.id);
        if (idx >= 0) { itemsRef.current[idx] = payload.item; render(); }
        return;
      }
      if (payload.type === "lock_all") {
        itemsRef.current = itemsRef.current.map(it => ({ ...it, locked: payload.locked })) as DrawItem[];
        render(); return;
      }
      if (payload.type === "privacy_mode") {
        privacyModeRef.current = payload.enabled;
        setPrivacyMode(payload.enabled);
        render(); return;
      }
      if (payload.type === "reveal_all") {
        itemsRef.current = itemsRef.current.map(it =>
          it.type === "frame" && (it as FrameItem).private ? { ...it, private: false } : it
        ) as DrawItem[];
        privacyModeRef.current = false;
        setPrivacyMode(false);
        render(); return;
      }
      if (payload.type === "hide_all") {
        itemsRef.current = itemsRef.current.map(it =>
          it.type === "frame" && (it as FrameItem).ownerStudentId ? { ...it, private: true } : it
        ) as DrawItem[];
        privacyModeRef.current = true;
        setPrivacyMode(true);
        render(); return;
      }
      if (payload.type === "video_sync") {
        const vid = videosRef.current.get(payload.id);
        if (payload.action === "pause") {
          if (vid) { vid.currentTime = payload.position; vid.pause(); }
        } else if (payload.action === "seek") {
          if (vid) vid.currentTime = payload.position;
        } else if (payload.action === "play") {
          if (vid) vid.currentTime = Math.max(0, payload.position);
          setPendingVideoSync(prev => { const m = new Map(prev); m.set(payload.id, { position: payload.position, sentAt: payload.sentAt }); return m; });
        }
        return;
      }
    };

    let localCh: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    async function connect() {
      // Ensure a Supabase session exists so the server accepts our broadcasts.
      // Students don't sign in with Supabase auth — sign them in anonymously
      // so the Realtime server treats them as authenticated and forwards their events.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }
      if (cancelled) return;
      localCh = supabase
        .channel(`board-${roomId}`, { config: { broadcast: { self: false } } })
        .on("broadcast", { event: "draw" }, handler)
        .subscribe(s => setConnected(s === "SUBSCRIBED"));
      channelRef.current = localCh;
    }

    connect();
    return () => {
      cancelled = true;
      if (localCh) supabase.removeChannel(localCh);
    };
  }, [roomId, render, applyView, loadPdfPage, animateGoto]);

  const send = (p: WsEvent) => channelRef.current?.send({ type: "broadcast", event: "draw", payload: p });

  const bringToMe  = () => { const { zoom, panX, panY } = viewRef.current; send({ type: "goto", zoom, panX, panY }); };
  const findStudent = () => { if (remoteViewportRef.current) { const { zoom, panX, panY } = remoteViewportRef.current; applyView(zoom, panX, panY); } };

  // cursor broadcast
  const broadcastCursor = (wx: number, wy: number) => {
    const now = Date.now(); if (now - cursorThrottle.current < 33) return;
    cursorThrottle.current = now; send({ type: "cursor", x: wx, y: wy });
  };

  // ── history ───────────────────────────────────────────────────────────────────
  const pushHistory = (entry: HistoryEntry) => {
    undoStack.current.push(entry); redoStack.current = [];
    setCanUndo(true); setCanRedo(false);
  };

  const undo = () => {
    const a = undoStack.current.pop(); if (!a) return;
    redoStack.current.push(a);
    if (a.type === "add")    { itemsRef.current = itemsRef.current.filter(i => i.id !== a.item.id); }
    if (a.type === "remove") { itemsRef.current.splice(a.idx, 0, a.item); }
    if (a.type === "update") { itemsRef.current[a.idx] = a.prev; setSelectedId(a.prev.id); }
    if (a.type === "clear")  { itemsRef.current = a.saved; }
    render(); setCanUndo(undoStack.current.length > 0); setCanRedo(true);
  };
  const redo = () => {
    const a = redoStack.current.pop(); if (!a) return;
    undoStack.current.push(a);
    if (a.type === "add")    { itemsRef.current.push(a.item); }
    if (a.type === "remove") { itemsRef.current = itemsRef.current.filter(i => i.id !== a.item.id); }
    if (a.type === "update") { itemsRef.current[a.idx] = a.next; setSelectedId(a.next.id); }
    if (a.type === "clear")  { itemsRef.current = []; }
    render(); setCanUndo(true); setCanRedo(redoStack.current.length > 0);
  };

  // ── inertia helpers ──────────────────────────────────────────────────────────
  const stopInertia = () => {
    if (inertiaRef.current) { cancelAnimationFrame(inertiaRef.current.rafId); inertiaRef.current = null; }
  };
  const startInertia = (vx: number, vy: number) => {
    stopInertia();
    const step = () => {
      if (!inertiaRef.current) return;
      inertiaRef.current.vx *= 0.92;
      inertiaRef.current.vy *= 0.92;
      const { vx: dx, vy: dy } = inertiaRef.current;
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) { inertiaRef.current = null; return; }
      const { zoom, panX, panY } = viewRef.current;
      applyView(zoom, panX + dx, panY + dy);
      inertiaRef.current.rafId = requestAnimationFrame(step);
    };
    inertiaRef.current = { vx, vy, rafId: requestAnimationFrame(step) };
  };

  // ── pointer down ─────────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    if (textInput !== null) { commitText(); return; }
    // Pending symbol placement — place on click, cancel on right-click
    if (pendingSymbol) {
      if (e.button === 2) { setPendingSymbol(null); setPendingSymbolPos(null); return; }
      if (e.button === 0) {
        const { cx, cy } = clientXY(e);
        const w = s2w(cx, cy);
        placeSymbol(pendingSymbol, w.x, w.y, pendingSymbol.length === 1 && pendingSymbol.codePointAt(0)! > 127 ? 48 : 32);
        setPendingSymbol(null); setPendingSymbolPos(null);
        return;
      }
    }
    stopInertia();
    if (e.button === 1 || spaceRef.current || tool === "hand") {
      const { cx, cy } = clientXY(e);
      panning.current = true;
      panOrigin.current = { cx, cy, vx: viewRef.current.panX, vy: viewRef.current.panY };
      lastPanPt.current = { cx, cy, t: Date.now() };
      e.preventDefault(); return;
    }
    if (e.button !== 0) return;
    const { cx, cy } = clientXY(e);
    const w = s2w(cx, cy);

    if (tool === "select") {
      // Resize handle on single selected text
      if (selectedId && selectedIds.size <= 1) {
        const selItem = itemsRef.current.find(i => i.id === selectedId);
        if (selItem?.type === "text") {
          const tb = textBounds(selItem as TextItem);
          const hs = w2s(tb.x1, tb.y1);
          if (Math.hypot(cx - hs.x, cy - hs.y) < 14) {
            selDragRef.current = { mode:"resize", id: selectedId, wx0: w.x, wy0: w.y,
              origItem: { ...selItem }, origFontSize: selItem.fontSize, origDiag: Math.max(20, Math.hypot(tb.w, tb.h)) };
            return;
          }
        }
      }
      // Hit test
      let hit: DrawItem | null = null;
      for (let i = itemsRef.current.length - 1; i >= 0; i--) {
        if (hitTest(itemsRef.current[i], w.x, w.y)) { hit = itemsRef.current[i]; break; }
      }
      if (hit) {
        if (hit.locked) {
          // Tutor can select locked items to unlock; student can't interact
          if (role === "tutor") { setSelectedId(hit.id); setSelectedIds(new Set([hit.id])); }
          return;
        }
        if (selectedIds.size > 1 && selectedIds.has(hit.id)) {
          // Start multi-drag
          const origItems = new Map<string, DrawItem>();
          for (const id of selectedIds) {
            const it = itemsRef.current.find(i => i.id === id);
            if (it) origItems.set(id, { ...it });
          }
          multiDragRef.current = { wx0: w.x, wy0: w.y, origItems };
        } else {
          // Single select
          setSelectedId(hit.id);
          setSelectedIds(new Set([hit.id]));
          selDragRef.current = { mode:"move", id: hit.id, wx0: w.x, wy0: w.y, origItem: { ...hit } };
        }
      } else {
        // Start rubber-band box selection
        setSelectedId(null);
        setSelectedIds(new Set());
        selBoxRef.current = { wx1: w.x, wy1: w.y, wx2: w.x, wy2: w.y };
        setSelBoxVis(true);
      }
      return;
    }

    if (tool === "text") {
      // Click on existing text → edit
      for (let i = itemsRef.current.length - 1; i >= 0; i--) {
        const it = itemsRef.current[i];
        if (it.type === "text" && hitTest(it, w.x, w.y)) {
          const ti = it as TextItem;
          editingIdRef.current = ti.id; setEditingId(ti.id);
          setTextInput({ wx: ti.x, wy: ti.y }); setTextValue(ti.text);
          setBold(ti.bold); setItalic(ti.italic); setAlign(ti.align); setFontSize(ti.fontSize);
          const fi = FONTS.findIndex(f => f.family === ti.font); setFontIdx(fi >= 0 ? fi : 0);
          render(); // hide original from canvas immediately
          setTimeout(() => {
            const ta = textRef.current; if (!ta) return;
            ta.focus();
            ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px";
          }, 30); return;
        }
      }
      setTextInput({ wx: w.x, wy: w.y }); setTextValue("");
      setTimeout(() => textRef.current?.focus(), 50); return;
    }

    if (tool === "laser" || tool === "image") return;

    if (tool === "shape") {
      const sp = snapPt(w.x, w.y);
      liveShapeRef.current = { wx1: sp.x, wy1: sp.y, wx2: sp.x, wy2: sp.y };
      return;
    }
    if (tool === "frame") {
      const sp = snapPt(w.x, w.y);
      liveFrameRef.current = { wx1: sp.x, wy1: sp.y, wx2: sp.x, wy2: sp.y };
      return;
    }

    if (tool === "eraser") {
      eraserActiveRef.current = true;
      eraserRadiusRef.current = size * 3;
      eraseAt(w.x, w.y); return;
    }

    // Drawing tools
    const pathId = uid();
    const hl = tool === "highlight";
    const c = hl ? hlColor : color;
    const s = hl ? Math.max(size * 3, 20) : size;
    livePathRef.current = {
      type:"path", id: pathId, points:[w], color:c, size:s, eraser:false, highlight:hl,
      ...(!hl && opacity < 100 ? { opacity } : {}),
    };
  };

  // ── pointer move ─────────────────────────────────────────────────────────────
  const onMouseMove = (e: React.MouseEvent) => {
    const { cx, cy } = clientXY(e);
    if (pendingSymbol) { setPendingSymbolPos({ sx: cx, sy: cy }); return; }
    if (panning.current) {
      applyView(viewRef.current.zoom, panOrigin.current.vx + cx - panOrigin.current.cx, panOrigin.current.vy + cy - panOrigin.current.cy);
      const now = Date.now();
      const last = lastPanPt.current;
      if (last && now - last.t < 80) {
        lastPanPt.current = { cx, cy, t: now };
      } else {
        lastPanPt.current = { cx, cy, t: now };
      }
      return;
    }
    const w = s2w(cx, cy);

    if (selBoxRef.current) {
      selBoxRef.current.wx2 = w.x;
      selBoxRef.current.wy2 = w.y;
      setPanVer(v => v + 1); return;
    }

    if (multiDragRef.current) {
      const { wx0, wy0, origItems } = multiDragRef.current;
      const ddx = w.x - wx0, ddy = w.y - wy0;
      for (const [id, orig] of origItems) {
        const idx = itemsRef.current.findIndex(i => i.id === id);
        if (idx >= 0) itemsRef.current[idx] = shiftItem(orig, ddx, ddy);
      }
      setPanVer(v => v + 1); render(); return;
    }

    if (selDragRef.current) {
      const drag = selDragRef.current;
      const idx = itemsRef.current.findIndex(i => i.id === drag.id);
      if (idx < 0) return;
      if (drag.mode === "move") {
        itemsRef.current[idx] = shiftItem(drag.origItem, w.x - drag.wx0, w.y - drag.wy0);
      } else if (drag.mode === "resize-img" || drag.mode === "resize-frame") {
        const orig = drag.origItem as ImageItem | FrameItem | VideoItem | FunctionItem;
        const dx = w.x - drag.wx0, dy = w.y - drag.wy0;
        let { x, y, w: ow, h: oh } = orig;
        const minSize = orig.type === "function" ? 2 : 20;
        if (drag.corner === "se") { ow = Math.max(minSize, ow + dx); oh = Math.max(minSize, oh + dy); }
        else if (drag.corner === "sw") { x = x + dx; ow = Math.max(minSize, ow - dx); oh = Math.max(minSize, oh + dy); }
        else if (drag.corner === "ne") { y = y + dy; ow = Math.max(minSize, ow + dx); oh = Math.max(minSize, oh - dy); }
        else { x = x + dx; y = y + dy; ow = Math.max(minSize, ow - dx); oh = Math.max(minSize, oh - dy); }
        itemsRef.current[idx] = { ...orig, x, y, w: ow, h: oh };
      } else {
        const item = itemsRef.current[idx] as TextItem;
        const tb = textBounds({ ...item, fontSize: drag.origFontSize } as TextItem);
        const newDiag = Math.max(20, Math.hypot(w.x - tb.x0, w.y - tb.y0));
        (itemsRef.current[idx] as TextItem).fontSize = Math.max(8, Math.round(drag.origFontSize * newDiag / drag.origDiag));
      }
      setPanVer(v => v + 1); render(); return;
    }

    broadcastCursor(w.x, w.y);
    if (tool === "eraser") setEraserPos({ sx: cx, sy: cy });
    else setEraserPos(null);
    if (tool === "laser") {
      setOwnLaser(w);
      if (ownLaserTimer.current) clearTimeout(ownLaserTimer.current);
      ownLaserTimer.current = setTimeout(() => setOwnLaser(null), 2500);
      send({ type:"laser", x:w.x, y:w.y }); return;
    }
    if (tool === "shape" && liveShapeRef.current) {
      const sp = snapPt(w.x, w.y);
      liveShapeRef.current.wx2 = sp.x; liveShapeRef.current.wy2 = sp.y;
      render(); return;
    }
    if (tool === "frame" && liveFrameRef.current) {
      const sp = snapPt(w.x, w.y);
      liveFrameRef.current.wx2 = sp.x; liveFrameRef.current.wy2 = sp.y;
      render(); return;
    }
    if (tool === "eraser" && eraserActiveRef.current) {
      eraseAt(w.x, w.y); return;
    }
    if (!livePathRef.current) return;
    const sp = snapPt(w.x, w.y);
    livePathRef.current.points.push(sp);
    const { color: c, size: s, eraser, highlight: hl, id } = livePathRef.current;
    render();
    send({ type:"path-pt", id, x:sp.x, y:sp.y, color:c, size:s, eraser, highlight:hl });
  };

  // ── pointer up ───────────────────────────────────────────────────────────────
  const onMouseUp = (e: React.MouseEvent) => {
    eraserActiveRef.current = false;
    if (e.button === 1 || panning.current) {
      panning.current = false;
      // launch inertia from last two recorded pan points
      const last = lastPanPt.current;
      const { cx, cy } = clientXY(e);
      if (last) {
        const dt = Math.max(1, Date.now() - last.t);
        const vx = (cx - last.cx) / dt * 14;
        const vy = (cy - last.cy) / dt * 14;
        if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) startInertia(vx, vy);
      }
      lastPanPt.current = null;
      return;
    }

    // Finalize rubber-band selection
    if (selBoxRef.current) {
      const sb = selBoxRef.current; selBoxRef.current = null; setSelBoxVis(false);
      const x0 = Math.min(sb.wx1, sb.wx2), x1 = Math.max(sb.wx1, sb.wx2);
      const y0 = Math.min(sb.wy1, sb.wy2), y1 = Math.max(sb.wy1, sb.wy2);
      const minSize = 4;
      if (x1 - x0 > minSize || y1 - y0 > minSize) {
        const caught = itemsRef.current.filter(item => {
          if (item.locked) return false;
          const b = itemBounds(item);
          // item must be fully inside or at least overlapping the selection box
          return b.x1 >= x0 && b.x0 <= x1 && b.y1 >= y0 && b.y0 <= y1;
        });
        if (caught.length === 1) {
          setSelectedId(caught[0].id);
          setSelectedIds(new Set([caught[0].id]));
        } else if (caught.length > 1) {
          setSelectedId(null);
          setSelectedIds(new Set(caught.map(i => i.id)));
        }
      }
      return;
    }

    // Finalize multi-drag
    if (multiDragRef.current) {
      const { origItems } = multiDragRef.current;
      pushHistory({ type:"clear", saved: [...itemsRef.current].map(i => origItems.get(i.id) ?? i) }); // save pre-drag positions
      for (const id of origItems.keys()) {
        const item = itemsRef.current.find(i => i.id === id);
        if (item) send({ type:"update", item });
      }
      multiDragRef.current = null; return;
    }

    if (selDragRef.current) {
      const drag = selDragRef.current;
      const idx = itemsRef.current.findIndex(i => i.id === drag.id);
      if (idx >= 0) {
        const next = itemsRef.current[idx];
        if (JSON.stringify(drag.origItem) !== JSON.stringify(next)) {
          pushHistory({ type:"update", idx, prev: drag.origItem, next: { ...next } });
          send({ type:"update", item: next });
        } else if (drag.mode === "move" && drag.origItem.type === "card") {
          const { cx, cy } = clientXY(e);
          const wp = s2w(cx, cy);
          if (isCardSpeakerHit(drag.origItem as CardItem, wp.x, wp.y)) speakWord((drag.origItem as CardItem).word);
          else flipCard(drag.origItem.id);
        }
      }
      selDragRef.current = null; return;
    }
    // Finalize frame
    if (tool === "frame" && liveFrameRef.current) {
      const lf = liveFrameRef.current; liveFrameRef.current = null;
      const fw = Math.abs(lf.wx2 - lf.wx1), fh = Math.abs(lf.wy2 - lf.wy1);
      if (fw > 20 && fh > 20) {
        const item: FrameItem = {
          type:"frame", id:uid(),
          x: Math.min(lf.wx1,lf.wx2), y: Math.min(lf.wy1,lf.wy2),
          w: fw, h: fh, shape: frameShape, title: "",
          color: frameColor, bgColor: frameFill,
          ...(frameOpacity < 100 ? { opacity: frameOpacity } : {}),
          borderWidth: frameBorderWidth,
          fontSize: frameFontSize, textColor: frameTextColor,
        };
        itemsRef.current.push(item); render();
        send({ type:"path", item }); pushHistory({ type:"add", item });
        setTool("select"); setSelectedId(item.id); setSelectedIds(new Set([item.id]));
      } else { render(); }
      return;
    }
    // Finalize shape
    if (tool === "shape" && liveShapeRef.current) {
      const ls = liveShapeRef.current; liveShapeRef.current = null;
      const minDist = 4;
      if (Math.abs(ls.wx2 - ls.wx1) > minDist || Math.abs(ls.wy2 - ls.wy1) > minDist) {
        const item: ShapeItem = {
          type: "shape", id: uid(), shape: shapeKind,
          x1: ls.wx1, y1: ls.wy1, x2: ls.wx2, y2: ls.wy2,
          color, size, fill: shapeFill ? color + "33" : undefined,
        };
        itemsRef.current.push(item); render();
        send({ type:"path", item }); pushHistory({ type:"add", item });
      } else { render(); }
      return;
    }
    if (!livePathRef.current) return;
    const item = livePathRef.current; livePathRef.current = null;
    itemsRef.current.push(item); render();
    send({ type:"path", item });
    pushHistory({ type:"add", item });
  };

  // ── touch ─────────────────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault();
    if (textInput !== null) { textRef.current?.blur(); return; }
    if (e.touches.length > 1) {
      if (selDragRef.current) { selDragRef.current = null; setTouchDragging(false); }
      livePathRef.current = null;
      liveShapeRef.current = null;
      panning.current = false;
      touchDrawPending.current = null;
      eraserActiveRef.current = false;
      if (e.touches.length === 2) {
        const r = containerRef.current!.getBoundingClientRect();
        const dx = e.touches[1].clientX - e.touches[0].clientX;
        const dy = e.touches[1].clientY - e.touches[0].clientY;
        pinchDist.current = Math.sqrt(dx*dx + dy*dy);
        pinchMid.current  = { x: (e.touches[0].clientX+e.touches[1].clientX)/2-r.left, y: (e.touches[0].clientY+e.touches[1].clientY)/2-r.top };
      }
      return;
    }
    const { cx, cy } = clientXY(e);
    const w = s2w(cx, cy);
    stopInertia();
    touchDrawPending.current = null;

    // place pending symbol first
    if (pendingSymbol) {
      placeSymbol(pendingSymbol, w.x, w.y, pendingSymbol.length === 1 && pendingSymbol.codePointAt(0)! > 127 ? 48 : 32);
      setPendingSymbol(null); setPendingSymbolPos(null); return;
    }

    // Text tool always creates new text at the tap point — never selects/moves
    if (tool === "text") {
      setSelectedId(null); setSelectedIds(new Set());
      setTextInput({ wx: w.x, wy: w.y }); setTextValue("");
      setTimeout(() => textRef.current?.focus(), 50); return;
    }

    // Drawing tools always draw — never select/drag on touch
    if (tool !== "pen" && tool !== "highlight" && tool !== "eraser" && tool !== "shape") {
      const hit = [...itemsRef.current].reverse().find(item => hitTest(item, w.x, w.y));
      if (hit) {
        if (hit.locked) {
          if (role === "tutor") { setSelectedId(hit.id); setSelectedIds(new Set([hit.id])); }
        } else {
          setSelectedId(hit.id);
          setSelectedIds(new Set([hit.id]));
          selDragRef.current = { mode: "move", id: hit.id, wx0: w.x, wy0: w.y, origItem: { ...hit } };
          flushSync(() => setTouchDragging(true));
        }
        return;
      }
    }

    // No item hit — deselect
    setSelectedId(null); setSelectedIds(new Set());
    if (tool === "laser") return;

    // All other tools: start panning. Drawing tools (pen/highlight/eraser/shape)
    // will switch from pan to draw once the finger moves more than the threshold.
    panning.current = true;
    panOrigin.current = { cx, cy, vx: viewRef.current.panX, vy: viewRef.current.panY };
    lastPanPt.current = { cx, cy, t: Date.now() };
    if (tool === "pen" || tool === "highlight" || tool === "eraser" || tool === "shape") {
      touchDrawPending.current = { cx, cy, wx: w.x, wy: w.y };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    const r = containerRef.current!.getBoundingClientRect();

    // Gesture disambiguation: switch from pan to draw once finger moves >8px
    if (touchDrawPending.current && e.touches.length === 1) {
      const moveCx = e.touches[0].clientX - r.left;
      const moveCy = e.touches[0].clientY - r.top;
      const dist = Math.hypot(moveCx - touchDrawPending.current.cx, moveCy - touchDrawPending.current.cy);
      if (dist > 8) {
        const start = touchDrawPending.current;
        touchDrawPending.current = null;
        panning.current = false;
        const sw = s2w(moveCx, moveCy);
        if (tool === "eraser") {
          eraserActiveRef.current = true; eraserRadiusRef.current = size * 3;
          eraseAt(start.wx, start.wy); eraseAt(sw.x, sw.y);
        } else if (tool === "shape") {
          const sp = snapPt(start.wx, start.wy);
          liveShapeRef.current = { wx1: sp.x, wy1: sp.y, wx2: sw.x, wy2: sw.y };
        } else {
          const hl = tool === "highlight";
          const c = hl ? hlColor : color;
          const s = hl ? Math.max(size * 3, 20) : size;
          const pathId = uid();
          livePathRef.current = {
            type:"path", id:pathId, points:[{x:start.wx,y:start.wy}, sw],
            color:c, size:s, eraser:false, highlight:hl,
            ...(!hl && opacity < 100 ? { opacity } : {}),
          };
          render();
        }
        return;
      }
    }

    if (e.touches.length === 2) {
      const dx = e.touches[1].clientX - e.touches[0].clientX;
      const dy = e.touches[1].clientY - e.touches[0].clientY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const mid  = { x: (e.touches[0].clientX+e.touches[1].clientX)/2-r.left, y: (e.touches[0].clientY+e.touches[1].clientY)/2-r.top };
      zoomAt(mid.x, mid.y, dist / pinchDist.current);
      const { zoom, panX, panY } = viewRef.current;
      applyView(zoom, panX + mid.x - pinchMid.current.x, panY + mid.y - pinchMid.current.y);
      pinchDist.current = dist; pinchMid.current = mid; return;
    }
    const { cx, cy } = clientXY(e);
    if (panning.current) {
      applyView(viewRef.current.zoom, panOrigin.current.vx + cx - panOrigin.current.cx, panOrigin.current.vy + cy - panOrigin.current.cy);
      lastPanPt.current = { cx, cy, t: Date.now() };
      return;
    }
    const w = s2w(cx, cy);
    broadcastCursor(w.x, w.y);
    if (selDragRef.current) {
      const drag = selDragRef.current;
      const idx = itemsRef.current.findIndex(i => i.id === drag.id);
      if (idx >= 0) {
        if (drag.mode === "move") {
          itemsRef.current[idx] = shiftItem(drag.origItem, w.x - drag.wx0, w.y - drag.wy0);
        } else if (drag.mode === "resize-img" || drag.mode === "resize-frame") {
          const orig = drag.origItem as ImageItem | FrameItem;
          const dx = w.x - drag.wx0, dy = w.y - drag.wy0;
          let { x, y, w: ow, h: oh } = orig;
          if (drag.corner === "se") { ow = Math.max(20, ow + dx); oh = Math.max(20, oh + dy); }
          else if (drag.corner === "sw") { x = x + dx; ow = Math.max(20, ow - dx); oh = Math.max(20, oh + dy); }
          else if (drag.corner === "ne") { y = y + dy; ow = Math.max(20, ow + dx); oh = Math.max(20, oh - dy); }
          else { x = x + dx; y = y + dy; ow = Math.max(20, ow - dx); oh = Math.max(20, oh - dy); }
          itemsRef.current[idx] = { ...orig, x, y, w: ow, h: oh };
        } else if (drag.mode === "resize") {
          const item = itemsRef.current[idx] as TextItem;
          const tb = textBounds({ ...item, fontSize: drag.origFontSize } as TextItem);
          const newDiag = Math.max(20, Math.hypot(w.x - tb.x0, w.y - tb.y0));
          (itemsRef.current[idx] as TextItem).fontSize = Math.max(8, Math.round(drag.origFontSize * newDiag / drag.origDiag));
        }
        render();
      }
      return;
    }
    if (tool === "shape" && liveShapeRef.current) {
      const sp = snapPt(w.x, w.y);
      liveShapeRef.current.wx2 = sp.x; liveShapeRef.current.wy2 = sp.y;
      render(); return;
    }
    if (tool === "laser") { setOwnLaser(w); if (ownLaserTimer.current) clearTimeout(ownLaserTimer.current); ownLaserTimer.current = setTimeout(() => setOwnLaser(null), 2500); send({ type:"laser", x:w.x, y:w.y }); return; }
    if (tool === "eraser" && eraserActiveRef.current) { eraseAt(w.x, w.y); return; }
    if (!livePathRef.current) return;
    livePathRef.current.points.push(w);
    const { color: c, size: s, eraser, highlight:hl, id } = livePathRef.current;
    render(); send({ type:"path-pt", id, x:w.x, y:w.y, color:c, size:s, eraser, highlight:hl });
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    e.preventDefault();
    // Eraser tap: finger lifted before crossing draw threshold — erase at touch point
    if (tool === "eraser" && touchDrawPending.current) {
      eraserRadiusRef.current = size * 3;
      eraseAt(touchDrawPending.current.wx, touchDrawPending.current.wy);
    }
    touchDrawPending.current = null;
    if (e.touches.length === 1 && !panning.current) {
      // One finger remains after pinch — re-enable panning from current finger position
      const r = containerRef.current!.getBoundingClientRect();
      const cx = e.touches[0].clientX - r.left;
      const cy = e.touches[0].clientY - r.top;
      panning.current = true;
      panOrigin.current = { cx, cy, vx: viewRef.current.panX, vy: viewRef.current.panY };
      lastPanPt.current = { cx, cy, t: Date.now() };
    } else if (e.touches.length < 2 && panning.current) {
      panning.current = false;
      const last = lastPanPt.current;
      if (last && e.changedTouches.length > 0) {
        const r = containerRef.current!.getBoundingClientRect();
        const cx = e.changedTouches[0].clientX - r.left;
        const cy = e.changedTouches[0].clientY - r.top;
        const dt = Math.max(1, Date.now() - last.t);
        const vx = (cx - last.cx) / dt * 14;
        const vy = (cy - last.cy) / dt * 14;
        if (Math.abs(vx) > 0.5 || Math.abs(vy) > 0.5) startInertia(vx, vy);
      }
      lastPanPt.current = null;
    }
    if (e.touches.length === 0 && selDragRef.current) {
      const drag = selDragRef.current;
      selDragRef.current = null;
      setTouchDragging(false);
      const idx = itemsRef.current.findIndex(i => i.id === drag.id);
      if (idx >= 0) {
        const next = itemsRef.current[idx];
        if (JSON.stringify(drag.origItem) !== JSON.stringify(next)) {
          pushHistory({ type:"update", idx, prev: drag.origItem, next: { ...next } });
          send({ type:"update", item: next });
        } else if (drag.mode === "move" && drag.origItem.type === "card") {
          if (e.changedTouches.length > 0) {
            const r = containerRef.current!.getBoundingClientRect();
            const wp = s2w(e.changedTouches[0].clientX - r.left, e.changedTouches[0].clientY - r.top);
            if (isCardSpeakerHit(drag.origItem as CardItem, wp.x, wp.y)) speakWord((drag.origItem as CardItem).word);
            else flipCard(drag.origItem.id);
          } else {
            flipCard(drag.origItem.id);
          }
        }
      }
    }
    if (e.touches.length === 0 && liveShapeRef.current) {
      const ls = liveShapeRef.current; liveShapeRef.current = null;
      const fw = Math.abs(ls.wx2 - ls.wx1), fh = Math.abs(ls.wy2 - ls.wy1);
      if (fw > 4 || fh > 4) {
        const item: DrawItem = {
          type:"shape", id:uid(), shape:shapeKind,
          x1:Math.min(ls.wx1,ls.wx2), y1:Math.min(ls.wy1,ls.wy2),
          x2:Math.max(ls.wx1,ls.wx2), y2:Math.max(ls.wy1,ls.wy2),
          color, size, fill: shapeFill ? color+"33" : undefined,
        };
        itemsRef.current.push(item); render(); send({ type:"path", item }); pushHistory({ type:"add", item });
      }
    }
    if (e.touches.length === 0 && livePathRef.current) {
      const item = livePathRef.current; livePathRef.current = null;
      itemsRef.current.push(item); render(); send({ type:"path", item }); pushHistory({ type:"add", item });
    }
  };

  // ── text commit ───────────────────────────────────────────────────────────────
  const commitText = () => {
    const eid = editingIdRef.current;
    if (!textInput || !textValue.trim()) {
      editingIdRef.current = null; setEditingId(null); setTextInput(null); render(); return;
    }
    const newItem: TextItem = {
      type:"text", id: eid ?? uid(),
      x: textInput.wx, y: textInput.wy, text: textValue,
      font: FONTS[fontIdx].family, color, fontSize, bold, italic, align,
      ...(textBgOpacity > 0 ? { bgColor: textBgColor, bgOpacity: textBgOpacity } : {}),
      ...(textOpacity < 100 ? { opacity: textOpacity } : {}),
    };
    if (eid) {
      const idx = itemsRef.current.findIndex(i => i.id === eid);
      if (idx >= 0) {
        pushHistory({ type:"update", idx, prev: itemsRef.current[idx], next: newItem });
        itemsRef.current[idx] = newItem;
      }
      editingIdRef.current = null; setEditingId(null); setSelectedId(eid);
    } else {
      itemsRef.current.push(newItem);
      pushHistory({ type:"add", item: newItem });
      setSelectedId(newItem.id); setSelectedIds(new Set([newItem.id]));
    }
    send({ type:"path", item: newItem }); render(); setTextInput(null); setTextValue("");
    // Switch to select so text can be dragged immediately without tool change
    setTool("select");
  };

  // ── add image ─────────────────────────────────────────────────────────────────
  const addImageToBoard = (url: string) => {
    if (!url.trim()) return;
    setImgError(null);
    const DEFAULT_W = 400;
    const placeItem = (w: number, h: number) => {
      const { zoom, panX, panY } = viewRef.current;
      const container = containerRef.current;
      const cx = container ? (container.clientWidth / 2 - panX) / zoom : 200;
      const cy = container ? (container.clientHeight / 2 - panY) / zoom : 200;
      const item: ImageItem = {
        type: "image", id: uid(),
        x: cx - w / 2, y: cy - h / 2,
        w, h, url,
      };
      itemsRef.current.push(item); render();
      send({ type: "path", item }); pushHistory({ type: "add", item });
      setImgDialog(false); setImgUrl("");
    };
    // Try cache first (instant)
    const cached = getCachedImage(url, () => {});
    if (cached) {
      const ratio = cached.naturalHeight / cached.naturalWidth;
      placeItem(DEFAULT_W, Math.round(DEFAULT_W * ratio));
      return;
    }
    // Pre-load to validate URL and get dimensions
    const img = new window.Image();
    img.onload = () => placeItem(DEFAULT_W, Math.max(50, Math.round(DEFAULT_W * img.naturalHeight / img.naturalWidth)));
    img.onerror = () => setImgError("Не удалось загрузить изображение. Проверьте ссылку.");
    img.src = url;
  };

  const [fullscreenVideo, setFullscreenVideo] = useState<string | null>(null);

  // ── PDF page picker dialog ───────────────────────────────────────────────────
  type PdfPickerState = {
    url: string;
    thumbs: string[];       // data-url per page (empty string = loading)
    total: number;
    selected: Set<number>;  // 1-based page numbers
  };
  const [pdfPicker, setPdfPicker] = useState<PdfPickerState | null>(null);
  const [pdfPickerLoading, setPdfPickerLoading] = useState(false);

  const openPdfPicker = async (url: string) => {
    setPdfPickerLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjsLib.getDocument({ url }).promise;
      const total = doc.numPages;
      const thumbs: string[] = new Array(total).fill("");
      setPdfPicker({ url, thumbs, total, selected: new Set() });
      setPdfPickerLoading(false);
      // Render thumbnails progressively
      for (let i = 1; i <= total; i++) {
        const pg = await doc.getPage(i);
        const vp0 = pg.getViewport({ scale: 1 });
        const scale = 160 / vp0.width;
        const vp = pg.getViewport({ scale });
        const tc = document.createElement("canvas");
        tc.width = Math.round(vp.width); tc.height = Math.round(vp.height);
        await pg.render({ canvas: tc, viewport: vp }).promise;
        thumbs[i - 1] = tc.toDataURL("image/jpeg", 0.8);
        setPdfPicker(p => p ? { ...p, thumbs: [...thumbs] } : p);
      }
    } catch(e) {
      console.error("PDF picker error", e);
      setPdfPickerLoading(false);
    }
  };

  const addPdfPagesToBoard = async (state: PdfPickerState) => {
    if (state.selected.size === 0) return;
    setPdfPickerLoading(true);
    try {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const doc = await pdfjsLib.getDocument({ url: state.url }).promise;
      const pages = Array.from(state.selected).sort((a, b) => a - b);
      const { zoom, panX, panY } = viewRef.current;
      const cv = canvasRef.current;
      const dpr = window.devicePixelRatio || 1;
      const cx = cv ? (cv.width / dpr / 2 - panX) / zoom : 400;
      let cy = cv ? (cv.height / dpr / 2 - panY) / zoom : 300;
      for (const pageNum of pages) {
        const pg = await doc.getPage(pageNum);
        const vp0 = pg.getViewport({ scale: 1 });
        const scale = Math.min(1600 / vp0.width, 900 / vp0.height, 2);
        const vp = pg.getViewport({ scale });
        const tmp = document.createElement("canvas");
        tmp.width = Math.round(vp.width); tmp.height = Math.round(vp.height);
        await pg.render({ canvas: tmp, viewport: vp }).promise;
        const dataUrl = tmp.toDataURL("image/jpeg", 0.88);
        const w = Math.min(tmp.width / scale, 800);
        const h = Math.round(w * (tmp.height / tmp.width));
        const item: ImageItem = {
          type: "image", id: uid(), url: dataUrl,
          x: cx - w / 2, y: cy - h / 2, w, h,
        };
        const img = new Image(); img.src = dataUrl;
        img.onload = () => { imgCache.set(dataUrl, img); };
        itemsRef.current.push(item);
        send({ type: "path", item }); pushHistory({ type: "add", item });
        cy += h + 24; // stack pages vertically
      }
      render();
      setPdfPicker(null);
    } catch(e) { console.error("PDF add pages error", e); }
    finally { setPdfPickerLoading(false); }
  };

  const addVideoToBoard = (url: string) => {
    const { zoom, panX, panY } = viewRef.current;
    const cv = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cx = cv ? (cv.width / dpr / 2 - panX) / zoom : 400;
    const cy = cv ? (cv.height / dpr / 2 - panY) / zoom : 300;
    const w = 480, h = 270;
    const item: VideoItem = {
      type: "video", id: uid(), url,
      x: cx - w/2, y: cy - h/2, w, h,
    };
    itemsRef.current.push(item); render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
  };

  const uploadAndAddImage = async (file: File) => {
    setImgError(null);
    setImgUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const res = await fetch("/api/board/image", { method: "POST", body: form });
      if (!res.ok) {
        let detail = `${res.status}`;
        try { const j = await res.json(); detail = j.error ?? detail; } catch { /* ignore */ }
        console.error("[uploadAndAddImage] server error:", res.status, detail);
        setImgError(`Не удалось загрузить (${detail}). Попробуйте ещё раз.`);
        return;
      }
      const { url } = await res.json();
      addImageToBoard(url);
    } catch (err) {
      console.error("[uploadAndAddImage] network error:", err);
      setImgError("Ошибка сети. Проверьте подключение.");
    } finally { setImgUploading(false); }
  };

  const uploadAndAddVideo = async (file: File) => {
    setVideoUploadProgress(0);
    setVideoUploadError(null);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "mp4";
      const res = await fetch("/api/board/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ext }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setVideoUploadError(err.error ?? "Ошибка подготовки загрузки");
        setVideoUploadProgress(null); return;
      }
      const { signedUrl, publicUrl, contentType } = await res.json();
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setVideoUploadProgress(Math.round(e.loaded / e.total * 100));
        };
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`${xhr.status}`));
        xhr.onerror = () => reject(new Error("Ошибка сети"));
        xhr.open("PUT", signedUrl);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.send(file);
      });
      addVideoToBoard(publicUrl);
    } catch (err) {
      setVideoUploadError(err instanceof Error ? err.message : "Ошибка загрузки");
    } finally {
      setVideoUploadProgress(null);
    }
  };


  const handleAiLayout = async (file: File) => {
    setAiLoading(true);
    try {
      const form = new FormData();
      form.append("image", file);
      const res = await fetch("/api/ai-layout", { method: "POST", body: form });
      if (!res.ok) throw new Error("AI failed");
      const { items } = await res.json();
      if (!Array.isArray(items) || items.length === 0) return;

      // Bounding box of returned items
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const it of items) {
        minX = Math.min(minX, it.x); minY = Math.min(minY, it.y);
        maxX = Math.max(maxX, it.x + (it.w ?? 200));
        maxY = Math.max(maxY, it.y + (it.h ?? 40));
      }
      // Center layout on current viewport
      const cont = containerRef.current!;
      const { zoom, panX, panY } = viewRef.current;
      const cx = (cont.clientWidth  / 2 - panX) / zoom;
      const cy = (cont.clientHeight / 2 - panY) / zoom;
      const dx = cx - (minX + maxX) / 2;
      const dy = cy - (minY + maxY) / 2;

      for (const raw of items) {
        const item = { ...raw, id: uid(), x: raw.x + dx, y: raw.y + dy };
        itemsRef.current.push(item);
        send({ type: "path", item });
        pushHistory({ type: "add", item });
      }
      render();
    } catch (err) {
      console.error("AI layout:", err);
    } finally {
      setAiLoading(false);
    }
  };

  const placeSymbol = (sym: string, wx: number, wy: number, fs = 32) => {
    const item: TextItem = {
      type: "text", id: uid(), x: wx, y: wy,
      text: sym, font: "Arial, sans-serif",
      color, fontSize: fs, bold: false, italic: false, align: "center",
      isSymbol: true,
    };
    itemsRef.current.push(item); render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
  };
  const insertSymbol = (sym: string) => {
    setPendingSymbol(sym);
    setShowSymbols(false);
  };
  const addFunction = () => {
    const trimmed = fnFormula.trim();
    if (!trimmed) return;
    const fn = parseFormula(trimmed);
    if (!fn) { setFnError(true); return; }
    setFnError(false);
    const { zoom, panX, panY } = viewRef.current;
    const cont = containerRef.current;
    const cw = cont?.clientWidth ?? 800, ch = cont?.clientHeight ?? 600;
    // Box size = 45% of screen width in world units, same for height
    const W = Math.round(cw * 0.45 / zoom);
    const H = W;
    // Place box centered in current viewport
    const cx = (cw / 2 - panX) / zoom;
    const cy = (ch / 2 - panY) / zoom;
    const item: FunctionItem = {
      type: "function", id: uid(), formula: trimmed, color, lineWidth: size,
      x: cx - W / 2, y: cy - H / 2, w: W, h: H,
      xMin: -5, xMax: 5, yMin: -5, yMax: 5,
    };
    itemsRef.current.push(item);
    render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
    setFnFormula("");
  };

  const addFormulaToBoard = () => {
    const latex = formulaInput.trim(); if (!latex) return;
    const { zoom, panX, panY } = viewRef.current;
    const cont = containerRef.current;
    const cw = cont?.clientWidth ?? 800, ch = cont?.clientHeight ?? 600;
    const W = Math.round(Math.max(200, cw * 0.35 / zoom));
    const H = Math.round(Math.max(80, ch * 0.12 / zoom));
    const cx = (cw / 2 - panX) / zoom, cy = (ch / 2 - panY) / zoom;
    const item: FormulaItem = { type: "formula", id: uid(), x: cx - W / 2, y: cy - H / 2, w: W, h: H, latex, color: "#1a1a1a", fontSize: 18 };
    itemsRef.current.push(item); render();
    send({ type: "path", item }); pushHistory({ type: "add", item });
    setFormulaInput(""); setShowFormulaPanel(false); setPanVer(v => v + 1);
  };

  const addCodeToBoard = () => {
    const content = codeInput.trim(); if (!content) return;
    const { zoom, panX, panY } = viewRef.current;
    const cont = containerRef.current;
    const cw = cont?.clientWidth ?? 800, ch = cont?.clientHeight ?? 600;
    const W = Math.round(Math.max(300, cw * 0.45 / zoom));
    const H = Math.round(Math.max(150, ch * 0.3 / zoom));
    const cx = (cw / 2 - panX) / zoom, cy = (ch / 2 - panY) / zoom;
    const item: CodeItem = { type: "code", id: uid(), x: cx - W / 2, y: cy - H / 2, w: W, h: H, content, language: codeLang };
    itemsRef.current.push(item); render();
    send({ type: "path", item }); pushHistory({ type: "add", item });
    setCodeInput(""); setShowCodePanel(false); setPanVer(v => v + 1);
  };

  // ── eraser: removes paths/shapes that the cursor touches ──────────────────────
  const eraserActiveRef  = useRef(false);
  const eraserRadiusRef  = useRef(size * 2);
  const [eraserPos, setEraserPos] = useState<{ sx: number; sy: number } | null>(null);
  const eraseAt = (wx: number, wy: number) => {
    const r = eraserRadiusRef.current;
    const before = itemsRef.current.length;
    itemsRef.current = itemsRef.current.filter(item => {
      if (item.locked) return true;
      if (item.type === "path") {
        return !item.points.some(p => Math.hypot(p.x - wx, p.y - wy) <= r);
      }
      if (item.type === "shape") {
        const b = itemBounds(item);
        return !(wx >= b.x0 - r && wx <= b.x1 + r && wy >= b.y0 - r && wy <= b.y1 + r);
      }
      if (item.type === "function") {
        return !(wx >= item.x - r && wx <= item.x + item.w + r && wy >= item.y - r && wy <= item.y + item.h + r);
      }
      return true;
    });
    if (itemsRef.current.length !== before) {
      render();
      // Broadcast clear+reload approach: just send an update for each removed item
      send({ type: "clear" });
      itemsRef.current.forEach(item => send({ type: "path", item }));
    }
  };

  const handleClear = () => {
    if (itemsRef.current.length === 0) return;
    pushHistory({ type:"clear", saved: [...itemsRef.current] });
    itemsRef.current = []; render(); send({ type:"clear" });
  };

  // ── lock toggle ───────────────────────────────────────────────────────────────
  const toggleLock = (id: string) => {
    const idx = itemsRef.current.findIndex(i => i.id === id);
    if (idx < 0) return;
    const prev = itemsRef.current[idx];
    const next  = { ...prev, locked: !prev.locked } as DrawItem;
    pushHistory({ type:"update", idx, prev, next });
    itemsRef.current[idx] = next; render();
    send({ type:"update", item: next });
  };

  const lockAll = (locked: boolean) => {
    itemsRef.current = itemsRef.current.map(it => ({ ...it, locked })) as DrawItem[];
    render();
    send({ type: "lock_all", locked });
  };

  // ── layer order helpers ──────────────────────────────────────────────────────
  const reorderItem = (id: string, dir: "front" | "back" | "forward" | "backward") => {
    const arr = itemsRef.current;
    const idx = arr.findIndex(i => i.id === id);
    if (idx < 0) return;
    pushHistory({ type:"clear", saved: [...arr] });
    const item = arr.splice(idx, 1)[0];
    if      (dir === "front")    arr.push(item);
    else if (dir === "back")     arr.unshift(item);
    else if (dir === "forward")  arr.splice(Math.min(idx + 1, arr.length), 0, item);
    else                         arr.splice(Math.max(idx - 1, 0), 0, item);
    render();
    send({ type:"clear" });
    arr.forEach(i => send({ type:"path", item: i }));
  };

  // ── board dice/wheel helpers ─────────────────────────────────────────────────
  const addDiceToBoard = (count = 1) => {
    const { zoom, panX, panY } = viewRef.current;
    const cv = canvasRef.current; const dpr = window.devicePixelRatio || 1;
    const cx = cv ? (cv.width / dpr / 2 - panX) / zoom : 400;
    const cy = cv ? (cv.height / dpr / 2 - panY) / zoom : 300;
    const item: DiceItem = { type:"dice", id:uid(), x:cx-90, y:cy-90, w:180, h:180, count, result:[] };
    itemsRef.current.push(item); render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
  };

  const addWheelToBoard = () => {
    const { zoom, panX, panY } = viewRef.current;
    const cv = canvasRef.current; const dpr = window.devicePixelRatio || 1;
    const cx = cv ? (cv.width / dpr / 2 - panX) / zoom : 400;
    const cy = cv ? (cv.height / dpr / 2 - panY) / zoom : 300;
    const item: WheelItem = { type:"wheel", id:uid(), x:cx-140, y:cy-160, w:280, h:320,
      items:["Вариант 1","Вариант 2","Вариант 3","Вариант 4"], angle:0 };
    itemsRef.current.push(item); render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
  };

  const updateBoardItem = (next: DrawItem) => {
    const idx = itemsRef.current.findIndex(i => i.id === next.id);
    if (idx < 0) return;
    const prev = itemsRef.current[idx];
    itemsRef.current[idx] = next;
    send({ type:"update", item: next });
    pushHistory({ type:"update", idx, prev, next });
    render();
  };

  const saveWheelEdit = () => {
    if (!editWheelId) return;
    const items = editWheelText.split("\n").map(s=>s.trim()).filter(Boolean);
    const idx = itemsRef.current.findIndex(i => i.id === editWheelId);
    if (idx >= 0) {
      const next = { ...itemsRef.current[idx], items } as WheelItem;
      updateBoardItem(next);
    }
    setEditWheelId(null);
  };

  const addTableToBoard = (rows = 3, cols = 3) => {
    const { zoom, panX, panY } = viewRef.current;
    const cv = canvasRef.current; const dpr = window.devicePixelRatio || 1;
    const cx = cv ? (cv.width / dpr / 2 - panX) / zoom : 400;
    const cy = cv ? (cv.height / dpr / 2 - panY) / zoom : 300;
    const w = Math.max(240, cols * 80), h = Math.max(120, rows * 36);
    const data = Array.from({ length: rows }, () => Array(cols).fill(""));
    const item: TableItem = { type:"table", id:uid(), x:cx-w/2, y:cy-h/2, w, h, rows, cols, data, headerRow: true, fontSize: 13 };
    itemsRef.current.push(item); render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
  };

  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showTablePicker, setShowTablePicker] = useState(false);

  const [openPicker, setOpenPicker] = useState<string | null>(null);
  const [pickerPos, setPickerPos] = useState<{ x: number; y: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const [kbOffset, setKbOffset] = useState(0);

  // ── load KaTeX + highlight.js once ───────────────────────────────────────────
  useEffect(() => {
    if (!document.querySelector('link[data-katex-css]')) {
      const l = document.createElement("link"); l.rel = "stylesheet";
      l.href = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css";
      l.setAttribute("data-katex-css", "1"); document.head.appendChild(l);
    }
    if (!document.querySelector('script[data-katex]')) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js";
      s.setAttribute("data-katex", "1"); document.head.appendChild(s);
    }
    if (!document.querySelector('link[data-hljs-css]')) {
      const l = document.createElement("link"); l.rel = "stylesheet";
      l.href = "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/styles/github.min.css";
      l.setAttribute("data-hljs-css", "1"); document.head.appendChild(l);
    }
    if (!document.querySelector('script[data-hljs]')) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/highlight.js@11.9.0/highlight.min.js";
      s.setAttribute("data-hljs", "1"); document.head.appendChild(s);
    }
  }, []);

  // ── dice ─────────────────────────────────────────────────────────────────────
  const rollDice = () => {
    setDiceRolling(true);
    let count = 0;
    const interval = setInterval(() => {
      setDiceResult(Array.from({ length: diceCount }, () => Math.ceil(Math.random() * 6)));
      count++;
      if (count >= 10) { clearInterval(interval); setDiceRolling(false); }
    }, 80);
  };

  const DICE_FACES = ["⚀","⚁","⚂","⚃","⚄","⚅"];

  // ── wheel of fortune ──────────────────────────────────────────────────────────
  const drawWheel = useCallback((angle: number, items: string[]) => {
    const cv = wheelCanvasRef.current;
    if (!cv || items.length === 0) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const W = cv.width, H = cv.height, cx = W / 2, cy = H / 2, r = Math.min(W, H) / 2 - 4;
    const slice = (Math.PI * 2) / items.length;
    const HUE_STEP = 360 / items.length;
    ctx.clearRect(0, 0, W, H);
    items.forEach((item, i) => {
      const start = angle + i * slice, end = start + slice;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = `hsl(${Math.round(i * HUE_STEP)},65%,62%)`; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(start + slice / 2);
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff"; ctx.font = `bold ${Math.min(14, 80 / items.length + 6)}px Arial`;
      ctx.fillText(item.length > 14 ? item.slice(0,13)+"…" : item, r - 8, 0);
      ctx.restore();
    });
    // Centre cap
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = "#fff"; ctx.fill(); ctx.strokeStyle = "#ccc"; ctx.lineWidth = 1; ctx.stroke();
    // Arrow
    ctx.save(); ctx.translate(W - 2, cy);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-20, -10); ctx.lineTo(-20, 10); ctx.closePath();
    ctx.fillStyle = "#333"; ctx.fill(); ctx.restore();
  }, []);

  useEffect(() => {
    const items = wheelItems.split("\n").map(s => s.trim()).filter(Boolean);
    drawWheel(wheelAngle, items);
  }, [wheelAngle, wheelItems, drawWheel, showWheel]);

  const spinWheel = () => {
    if (wheelSpinning) return;
    const items = wheelItems.split("\n").map(s => s.trim()).filter(Boolean);
    if (items.length < 2) return;
    setWheelResult(null); setWheelSpinning(true);
    const extraSpins = 5 + Math.random() * 5;
    const finalAngle = wheelAngle + extraSpins * Math.PI * 2 + Math.random() * Math.PI * 2;
    const duration = 3500;
    const start = performance.now();
    const startA = wheelAngle;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const animate = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const a = startA + (finalAngle - startA) * easeOut(t);
      setWheelAngle(a);
      drawWheel(a, items);
      if (t < 1) { requestAnimationFrame(animate); return; }
      setWheelSpinning(false);
      // Determine winner: arrow points right (angle 0), slice at -angle
      const norm = (((-a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2));
      const idx = Math.floor(norm / ((Math.PI * 2) / items.length)) % items.length;
      setWheelResult(items[idx]);
    };
    requestAnimationFrame(animate);
  };

  // ── overlay positions ─────────────────────────────────────────────────────────
  const laserScr  = laserPos     ? w2s(laserPos.x,     laserPos.y)     : null;
  const ownLaserS = ownLaser     ? w2s(ownLaser.x,     ownLaser.y)     : null;
  const remoteScr = remoteCursor ? w2s(remoteCursor.x, remoteCursor.y) : null;
  const textScr   = textInput    ? w2s(textInput.wx,   textInput.wy)   : null;
  const { zoom }  = viewRef.current;

  // Show single-item overlay only when exactly one item is selected
  const selectedItem = (selectedId && selectedIds.size <= 1) ? itemsRef.current.find(i => i.id === selectedId) : null;

  const cursor =
    spaceHeld || tool === "hand"   ? (panning.current ? "grabbing" : "grab")
    : tool === "select"            ? (selDragRef.current ? "grabbing" : "default")
    : tool === "text"              ? "text"
    : tool === "eraser"            ? "cell"
    : tool === "laser"             ? "none"
    : tool === "frame"             ? "crosshair"
    : "crosshair";

  // ── small UI helpers ──────────────────────────────────────────────────────────
  const ColorPalette = ({ colors, active, onPick }: { colors:string[]; active:string; onPick:(c:string)=>void }) => (
    <div className="flex gap-1.5 items-center flex-wrap">
      {colors.map(c => (
        <button key={c} onClick={() => onPick(c)} className="rounded-full border-2 transition-all"
          style={{ width:22, height:22, background:c, borderColor: active===c?"var(--brown-dark)":"transparent",
            boxShadow: c==="#ffffff"?"inset 0 0 0 1px #bbb":undefined }} />
      ))}
      {/* Custom color picker */}
      <label className="relative w-6 h-6 rounded-full border-2 overflow-hidden cursor-pointer"
        style={{ borderColor: ![...colors].includes(active) ? "var(--brown-dark)" : "var(--brown-pale)", background: active }}
        title="Свой цвет">
        <input type="color" value={active} onChange={e => onPick(e.target.value)}
          className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
      </label>
    </div>
  );

  // ── imperative handle ─────────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    getItems: () => [...itemsRef.current],
    loadItems: (items: DrawItem[]) => {
      itemsRef.current = items.map(it => ({ ...it }));
      undoStack.current = []; redoStack.current = [];
      setCanUndo(false); setCanRedo(false); setSelectedId(null);
      render();
    },
    mergeItems: (items: DrawItem[]) => {
      const existingIds = new Set(itemsRef.current.map(i => i.id));
      const newItems = items
        .map(it => ({ ...it, id: existingIds.has(it.id) ? uid() : it.id }));
      itemsRef.current = [...itemsRef.current, ...newItems];
      render();
    },
  }));

  // ── minimap rendering ─────────────────────────────────────────────────────────
  const renderMinimap = useCallback(() => {
    const mc = minimapRef.current;
    const main = canvasRef.current;
    if (!mc || !main) return;

    // DPR-aware sizing: canvas buffer = CSS size × DPR, so retina looks sharp
    const dpr = window.devicePixelRatio || 1;
    const CSS_W = 210, CSS_H = 130;
    const targetW = Math.round(CSS_W * dpr), targetH = Math.round(CSS_H * dpr);
    if (mc.width !== targetW || mc.height !== targetH) {
      mc.width = targetW; mc.height = targetH;
      mc.style.width = CSS_W + "px"; mc.style.height = CSS_H + "px";
    }
    const W = mc.width, H = mc.height; // physical pixels
    const mctx = mc.getContext("2d");
    if (!mctx) return;

    const items = itemsRef.current;
    const { zoom, panX, panY } = viewRef.current;
    const cont = containerRef.current;
    const cw = cont?.clientWidth ?? 800, ch = cont?.clientHeight ?? 600;

    // Current viewport in world coords
    const vx1 = -panX / zoom, vy1 = -panY / zoom;
    const vx2 = (cw - panX) / zoom, vy2 = (ch - panY) / zoom;

    // World content bounds: start from viewport, expand to include all items
    let minX = vx1, minY = vy1, maxX = vx2, maxY = vy2;
    for (const item of items) {
      const b = getItemBounds(item);
      if (!b) continue;
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    }
    const pad = Math.max((maxX - minX) * 0.06, 40);
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const bw = maxX - minX, bh = maxY - minY;

    // Physical pixels per world unit (scale to fit minimap buffer)
    const scale = Math.min(W / bw, H / bh);
    const offX = (W - bw * scale) / 2;
    const offY = (H - bh * scale) / 2;

    // Store in CSS pixel coords so the click handler works correctly on retina
    minimapMapRef.current = { minX, minY, scale: scale / dpr, offX: offX / dpr, offY: offY / dpr };

    const mx = (x: number) => (x - minX) * scale + offX;
    const my = (y: number) => (y - minY) * scale + offY;

    // Background
    mctx.fillStyle = "#f0ece6";
    mctx.fillRect(0, 0, W, H);

    // Off-screen items (not currently in the viewport) — draw as simple shapes
    mctx.globalAlpha = 0.75;
    for (const item of items) {
      const b = getItemBounds(item);
      if (!b) continue;
      // Skip items that overlap the viewport — they'll appear via drawImage below
      if (b.x < vx2 && b.x + b.w > vx1 && b.y < vy2 && b.y + b.h > vy1) continue;
      const sw = Math.max(b.w * scale, 2), sh = Math.max(b.h * scale, 2);
      if (item.type === "path") {
        const pts = (item as PathItem).points;
        if (pts.length >= 2) {
          mctx.save();
          mctx.strokeStyle = (item as PathItem).color ?? "#1a1a1a";
          mctx.lineWidth = Math.max(1.5, (item as PathItem).size * scale * 0.5);
          mctx.lineCap = "round"; mctx.lineJoin = "round";
          mctx.beginPath();
          mctx.moveTo(mx(pts[0].x), my(pts[0].y));
          for (let i = 1; i < pts.length; i++) mctx.lineTo(mx(pts[i].x), my(pts[i].y));
          mctx.stroke();
          mctx.restore();
          continue;
        }
        mctx.fillStyle = (item as PathItem).color ?? "#1a1a1a";
      } else if (item.type === "frame") {
        mctx.fillStyle = item.bgColor ?? "#e0e7ff";
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
        mctx.strokeStyle = item.color ?? "#6366f1";
        mctx.lineWidth = 1;
        mctx.strokeRect(mx(b.x), my(b.y), sw, sh);
        continue;
      } else if (item.type === "text") {
        mctx.fillStyle = "#f59e0b";
      } else if (item.type === "image") {
        mctx.fillStyle = "#10b981";
      } else if (item.type === "video") {
        mctx.fillStyle = "#6366f1";
      } else if (item.type === "shape") {
        mctx.fillStyle = item.fill ?? item.color ?? "#94a3b8";
      } else if (item.type === "function") {
        const fn = parseFormula((item as FunctionItem).formula);
        if (fn) {
          mctx.save();
          mctx.strokeStyle = (item as FunctionItem).color ?? "#4a80f0";
          mctx.lineWidth = 1.5; mctx.globalAlpha = 0.7;
          mctx.beginPath();
          let started = false;
          for (let i = 0; i <= 80; i++) {
            const wx = minX + bw * (i / 80), wy = -fn(wx);
            if (!isFinite(wy) || Math.abs(wy) > bh * 10) { started = false; continue; }
            if (!started) { mctx.moveTo(mx(wx), my(wy)); started = true; } else mctx.lineTo(mx(wx), my(wy));
          }
          mctx.stroke(); mctx.restore(); continue;
        }
        continue;
      } else {
        mctx.fillStyle = "#94a3b8";
      }
      mctx.fillRect(mx(b.x), my(b.y), sw, sh);
    }
    mctx.globalAlpha = 1;

    // Viewport area: copy pixel-perfect from the main canvas via drawImage.
    // main canvas shows world [vx1,vy1→vx2,vy2]; paste it into the corresponding
    // region of the minimap so visible content always matches exactly.
    const vpDstX = mx(vx1), vpDstY = my(vy1);
    const vpDstW = (vx2 - vx1) * scale, vpDstH = (vy2 - vy1) * scale;
    mctx.drawImage(main, 0, 0, main.width, main.height, vpDstX, vpDstY, vpDstW, vpDstH);

    // Viewport indicator — blue tint + border (current user)
    mctx.fillStyle = "rgba(59,130,246,0.08)";
    mctx.fillRect(vpDstX, vpDstY, vpDstW, vpDstH);
    mctx.strokeStyle = "#3b82f6";
    mctx.lineWidth = Math.max(1.5, dpr);
    mctx.strokeRect(vpDstX, vpDstY, vpDstW, vpDstH);

    // Remote viewport (student's view) — green border for tutor
    const rv = remoteViewportRef.current;
    if (role === "tutor" && rv) {
      const rvx1 = -rv.panX / rv.zoom, rvy1 = -rv.panY / rv.zoom;
      const rvx2 = (cw - rv.panX) / rv.zoom, rvy2 = (ch - rv.panY) / rv.zoom;
      const rvX = mx(rvx1), rvY = my(rvy1), rvW = (rvx2 - rvx1) * scale, rvH = (rvy2 - rvy1) * scale;
      mctx.fillStyle = "rgba(34,197,94,0.08)";
      mctx.fillRect(rvX, rvY, rvW, rvH);
      mctx.strokeStyle = "#22c55e";
      mctx.lineWidth = Math.max(1.5, dpr);
      mctx.setLineDash([4 * dpr, 3 * dpr]);
      mctx.strokeRect(rvX, rvY, rvW, rvH);
      mctx.setLineDash([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMinimap, role]);

  // keep fn ref in sync
  useEffect(() => { renderMinimapFnRef.current = renderMinimap; }, [renderMinimap]);

  // fit all content in view
  // ── vocab cards ───────────────────────────────────────────────────────────────
  const speakWord = useCallback((word: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(word);
    utt.lang = "en-GB"; utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  }, []);

  const flipCard = useCallback((id: string) => {
    const idx = itemsRef.current.findIndex(i => i.id === id);
    if (idx < 0) return;
    const card = itemsRef.current[idx] as CardItem;
    const pos = w2s(card.x, card.y);
    const { zoom } = viewRef.current;
    setFlipOverlay({
      id, sx: pos.x, sy: pos.y, sw: card.w * zoom, sh: card.h * zoom,
      rotation: card.rotation, word: card.word, translation: card.translation,
      fromHidden: card.hidden, instanceId: Date.now(),
    });
    setTimeout(() => {
      const i2 = itemsRef.current.findIndex(it => it.id === id);
      if (i2 < 0) return;
      (itemsRef.current[i2] as CardItem).hidden = !(itemsRef.current[i2] as CardItem).hidden;
      render();
      send({ type: "update", item: itemsRef.current[i2] });
      setFlipOverlay(null);
    }, 370);
  }, [render, send, w2s]);

  const loadVocabTopics = useCallback(async () => {
    setVocabLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("vocabulary_topics")
        .select("id, title, vocabulary_words(id, word, translation)")
        .eq("student_id", roomId)
        .order("created_at", { ascending: false });
      const mapped: VocabTopic[] = (data ?? []).map((t: {id:string;title:string;vocabulary_words:{id:string;word:string;translation:string}[]}) => ({ id: t.id, title: t.title, words: t.vocabulary_words }));
      setVocabTopics(mapped);
      if (mapped[0]) setVocabTopicId(mapped[0].id);
    } finally { setVocabLoading(false); }
  }, [roomId]);

  const addCardsToBoard = useCallback(() => {
    const topic = vocabTopics.find(t => t.id === vocabTopicId);
    if (!topic) return;
    const words = topic.words.filter(w => vocabSelWords.has(w.id));
    if (!words.length) return;
    const { panX, panY, zoom } = viewRef.current;
    const cont = containerRef.current;
    const CW = 120, CH = 80, GAP = 16;
    const perRow = Math.max(1, Math.floor(((cont?.clientWidth ?? 600) / zoom - GAP) / (CW + GAP)));
    words.forEach((w, i) => {
      const col = i % perRow, row = Math.floor(i / perRow);
      const rotation = (Math.random() * 8 - 4);
      const cx = (-panX / zoom) + GAP + col * (CW + GAP) + CW / 2;
      const cy = (-panY / zoom) + GAP + row * (CH + GAP) + CH / 2;
      const card: CardItem = {
        type: "card", id: uid(),
        word: w.word, translation: w.translation,
        hidden: vocabFaceDown,
        x: cx - CW / 2, y: cy - CH / 2, w: CW, h: CH, rotation,
      };
      itemsRef.current.push(card);
      send({ type: "path", item: card });
      pushHistory({ type: "add", item: card });
    });
    render();
    setShowVocabPanel(false);
    setVocabSelWords(new Set());
  }, [vocabTopics, vocabTopicId, vocabSelWords, vocabFaceDown, render, send, pushHistory]);

  const fitAll = useCallback(() => {
    const items = itemsRef.current;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const item of items) {
      const b = getItemBounds(item);
      if (!b) continue;
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    }
    const cont = containerRef.current;
    if (!cont) return;
    if (!isFinite(minX)) { applyView(1, 0, 0); render(); return; }
    const pad = 80;
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const cw = cont.clientWidth, ch = cont.clientHeight;
    const newZoom = Math.min(cw / (maxX - minX), ch / (maxY - minY), 3);
    applyView(newZoom, (cw - (maxX + minX) * newZoom) / 2, (ch - (maxY + minY) * newZoom) / 2);
    render();
  }, [applyView, render]);

  // ── JSX ───────────────────────────────────────────────────────────────────────
  // closes all sidebar popups (shape/frame/emoji panels)
  const closeSidePanels = () => { setShowShapeMenu(false); setShowFrameMenu(false); setShowEmojiPicker(false); };
  const pickTool = (t: Tool) => {
    liveShapeRef.current = null;
    livePathRef.current = null;
    eraserActiveRef.current = false;
    render();
    setTool(t); closeSidePanels();
  };

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as Element).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement).isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // e.code — физическая клавиша, работает при любой раскладке (рус/англ)
      switch (e.code) {
        case "Escape": setPendingSymbol(null); setPendingSymbolPos(null); setShowEmojiPicker(false); setShowVocabPanel(false); break;
        case "KeyV": setTool("select"); closeSidePanels(); break;
        case "KeyH": setTool("hand");   closeSidePanels(); break;
        case "KeyP": setTool("pen");    closeSidePanels(); break;
        case "KeyM": setTool("highlight"); closeSidePanels(); break;
        case "KeyT": setTool("text");   closeSidePanels(); break;
        case "KeyE": setTool("eraser"); closeSidePanels(); break;
        case "KeyL": setTool("laser");  closeSidePanels(); break;
        case "KeyS": setTool("shape"); closeSidePanels(); setShowShapeMenu(m => !m); break;
        case "KeyF": setTool("frame"); closeSidePanels(); setShowFrameMenu(m => !m); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (cropDragRef.current) {
      window.removeEventListener("mousemove", cropDragRef.current.move);
      window.removeEventListener("mouseup", cropDragRef.current.up);
    }
  }, []);

  useEffect(() => {
    if (!openPicker) return;
    const onDown = (e: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpenPicker(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPicker(null);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [openPicker]);

  useEffect(() => {
    setOpenPicker(null);
    setPickerPos(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    if (textInput === null) { setKbOffset(0); return; }
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setKbOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => { vv.removeEventListener("resize", update); vv.removeEventListener("scroll", update); };
  }, [textInput]);

  useEffect(() => {
    setShowShapeMenu(false); setShowFrameMenu(false); setShowMoreTools(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  useEffect(() => {
    if (!showShapeMenu && !showFrameMenu && !showMoreTools) return;
    const closeAll = () => { setShowShapeMenu(false); setShowFrameMenu(false); setShowMoreTools(false); };
    const onDown = (e: PointerEvent) => {
      if (sideMenuRef.current && !sideMenuRef.current.contains(e.target as Node)) closeAll();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [showShapeMenu, showFrameMenu, showMoreTools]);

  return (
    <div className="flex flex-1 overflow-hidden select-none" style={{ touchAction: "none" }}>

      {/* Vertical sidebar */}
      <aside className="hidden sm:flex flex-col items-center gap-1 py-2 border-r shrink-0 relative"
        data-no-prevent
        style={{ width: 52, overflowX: "hidden", overflowY: "auto", borderColor:"var(--brown-pale)", background:"white" }}>
        <SideBtn active={tool==="select"} onClick={()=>pickTool("select")} title="Выбор [V]"><Pointer size={16}/></SideBtn>
        <SideBtn active={tool==="hand"} onClick={()=>pickTool("hand")} title="Рука [H]"><Hand size={16}/></SideBtn>
        <div className="w-8 h-px mx-auto my-1" style={{ background:"var(--brown-pale)" }}/>
        <SideBtn active={tool==="pen"} onClick={()=>pickTool("pen")} title="Карандаш [P]"><Pencil size={16}/></SideBtn>
        <SideBtn active={tool==="highlight"} onClick={()=>pickTool("highlight")} title="Маркер [M]"><Highlighter size={16}/></SideBtn>
        <SideBtn active={tool==="eraser"} onClick={()=>pickTool("eraser")} title="Ластик [E]"><Eraser size={16}/></SideBtn>
        <SideBtn active={tool==="text"} onClick={()=>pickTool("text")} title="Текст [T]"><Type size={16}/></SideBtn>
        <SideBtn active={tool==="laser"} onClick={()=>pickTool("laser")} title="Указка [L]"><MousePointer2 size={16}/></SideBtn>
        <div className="w-8 h-px mx-auto my-1" style={{ background:"var(--brown-pale)" }}/>
        {/* Shape with submenu */}
        <div className="relative" ref={shapeMenuAnchorRef}>
          <SideBtn active={tool==="shape"} onClick={()=>{
            const r = shapeMenuAnchorRef.current?.getBoundingClientRect();
            if (r) setShapeMenuPos({ top: r.top, left: r.right + 8 });
            closeSidePanels(); setTool("shape"); setShowShapeMenu(m=>!m);
          }} title="Фигуры [S]">
            <Shapes size={16}/>
          </SideBtn>
          {showShapeMenu && shapeMenuPos && (
            <div ref={sideMenuRef} className="fixed z-[10000] rounded-xl border shadow-lg flex flex-col"
              style={{ background:"white", borderColor:"var(--brown-pale)", width:220, maxHeight:360, top: shapeMenuPos.top, left: shapeMenuPos.left }}
              onMouseDown={e => e.stopPropagation()}>
              <div className="overflow-y-auto flex-1 p-1.5">
              {SHAPE_KINDS.map(k => (
                <button key={k.v}
                  onMouseDown={e => e.stopPropagation()}
                  onClick={e => { e.stopPropagation(); setShapeKind(k.v); setTool("shape"); setShowShapeMenu(false); }}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm w-full text-left hover:opacity-70"
                  style={{ fontWeight:k.v===shapeKind?600:400, background:k.v===shapeKind?"var(--brown-pale)":"transparent", color:"var(--brown-dark)" }}>
                  <span className="w-5 text-center text-base">{k.icon}</span>{k.label}
                </button>
              ))}
              </div>
              <div className="border-t px-1.5 pb-1.5 pt-1 shrink-0" style={{ borderColor:"var(--brown-pale)" }}>
                <label className="flex items-center gap-2 px-2.5 py-1.5 text-sm cursor-pointer" style={{ color:"var(--brown-dark)" }}>
                  <input type="checkbox" checked={shapeFill} onChange={e=>setShapeFill(e.target.checked)}/> Заливка
                </label>
              </div>
            </div>
          )}
        </div>
        {/* Frame with submenu */}
        <div className="relative" ref={frameMenuAnchorRef}>
          <SideBtn active={tool==="frame"} onClick={()=>{
            const r = frameMenuAnchorRef.current?.getBoundingClientRect();
            if (r) setFrameMenuPos({ top: r.top, left: r.right + 8 });
            closeSidePanels(); setTool("frame"); setShowFrameMenu(m=>!m);
          }} title="Блок/фрейм [F]">
            <LayoutTemplate size={16}/>
          </SideBtn>
          {showFrameMenu && frameMenuPos && (
            <div ref={sideMenuRef} className="fixed z-[10000] rounded-xl border shadow-lg p-1.5 w-52"
              style={{ background:"white", borderColor:"var(--brown-pale)", top: frameMenuPos.top, left: frameMenuPos.left }}>
              {FRAME_SHAPES.map(k => (
                <button key={k.v} onClick={()=>{setFrameShape(k.v);setShowFrameMenu(false);setTool("frame");}}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm w-full text-left hover:opacity-70"
                  style={{ fontWeight:k.v===frameShape?600:400, background:k.v===frameShape?"var(--brown-pale)":"transparent", color:"var(--brown-dark)" }}>
                  <span className="w-5 text-center text-base">{k.icon}</span>{k.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <SideBtn active={tool==="image"} onClick={()=>{pickTool("image");setImgDialog(true);}} title="Картинка"><ImagePlus size={16}/></SideBtn>
        {/* Emoji picker button */}
        <SideBtn active={showEmojiPicker} onClick={()=>{setShowShapeMenu(false);setShowFrameMenu(false);setShowEmojiPicker(v=>!v);}} title="Эмодзи">
          <span className="text-base leading-none">😊</span>
        </SideBtn>
        {!profileHide.has("formula") && (
          <SideBtn active={showFormulaPanel} onClick={()=>{setShowFormulaPanel(v=>!v);setShowCodePanel(false);}} title="Формула LaTeX [∑]">
            <span className="text-sm font-bold leading-none">∑</span>
          </SideBtn>
        )}
        {!profileHide.has("code") && (
          <SideBtn active={showCodePanel} onClick={()=>{setShowCodePanel(v=>!v);setShowFormulaPanel(false);}} title="Блок кода">
            <span className="text-xs font-bold font-mono leading-none">{"</>"}</span>
          </SideBtn>
        )}
        <div className="flex-1"/>
        {/* More tools at bottom */}
        <div className="w-8 h-px mx-auto mb-1" style={{ background:"var(--brown-pale)" }}/>
        <div className="relative" ref={moreToolsAnchorRef}>
          <SideBtn active={showMoreTools} onClick={()=>{
            const r = moreToolsAnchorRef.current?.getBoundingClientRect();
            if (r) {
              const dropH = 300;
              if (r.top + dropH > window.innerHeight) {
                setMoreToolsPos({ bottom: window.innerHeight - r.bottom, left: r.right + 8 });
              } else {
                setMoreToolsPos({ top: r.top, left: r.right + 8 });
              }
            }
            setShowMoreTools(v=>!v);
          }} title="Ещё инструменты">
            <span className="text-lg font-bold leading-none">+</span>
          </SideBtn>
          {showMoreTools && moreToolsPos && (
            <div ref={sideMenuRef} className="fixed z-[10000] rounded-2xl border shadow-xl overflow-hidden"
              onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
              style={{ background:"white", borderColor:"var(--brown-pale)", width:260, top: moreToolsPos.top, bottom: moreToolsPos.bottom, left: moreToolsPos.left }}>
              <div className="px-3 py-2 text-xs font-medium border-b" style={{ color:"var(--brown-mid)", borderColor:"var(--brown-pale)" }}>Ещё инструменты</div>
              <div className="p-2 grid grid-cols-3 gap-1.5">
                {/* Symbols */}
                <button onClick={()=>{setShowSymbols(v=>!v);setShowMoreTools(false);}}
                  onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <span className="text-xl">∑</span><span className="text-xs">Символы</span>
                </button>
                {/* Dice */}
                <button onClick={()=>{setShowDice(v=>!v);setShowMoreTools(false);}}
                  onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <span className="text-xl">🎲</span><span className="text-xs">Кубик</span>
                </button>
                {/* Wheel */}
                <button onClick={()=>{setShowWheel(v=>!v);setShowMoreTools(false);}}
                  onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <span className="text-xl">🎡</span><span className="text-xs">Колесо</span>
                </button>
                {/* Vocab cards */}
                {role==="tutor" && !profileHide.has("card") && (
                  <button onClick={()=>{setShowVocabPanel(v=>!v);loadVocabTopics();setShowMoreTools(false);}}
                    onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                    style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                    <BookOpen size={20}/><span className="text-xs">Карточки</span>
                  </button>
                )}
                {/* Table */}
                {role==="tutor" && (
                  <button onClick={()=>{setShowTablePicker(v=>!v);setShowMoreTools(false);}}
                    onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                    className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                    style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                    <span className="text-xl">⊞</span><span className="text-xs">Таблица</span>
                  </button>
                )}
                {/* PDF on board */}
                {role==="tutor" && (
                  <label className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70 cursor-pointer"
                    style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                    <FileText size={20}/><span className="text-xs">PDF</span>
                    <input type="file" accept=".pdf,application/pdf" className="hidden"
                      onChange={e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";setShowMoreTools(false);openPdfPicker(URL.createObjectURL(f));}}/>
                  </label>
                )}
                {/* Video on board */}
                {role==="tutor" && (
                  <label className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70 cursor-pointer"
                    style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                    <span className="text-xl">🎬</span><span className="text-xs">Видео</span>
                    <input type="file" accept="video/*" className="hidden"
                      onChange={e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";setShowMoreTools(false);uploadAndAddVideo(f);}}/>
                  </label>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>

      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Context bar — tool options */}
        <div className="hidden sm:flex items-center border-b shrink-0"
          style={{ borderColor:"var(--brown-pale)", background:"white", minHeight:44 }}>

          {/* Left: tool-specific options, scrolls horizontally */}
          <div className="flex items-center gap-2 px-2 py-1.5 overflow-x-auto flex-1 min-w-0">

          {/* Left: tool-specific options */}
          {tool === "highlight" && <ColorPalette colors={HIGHLIGHT_COLORS} active={hlColor} onPick={setHlColor} />}
          {(tool === "select" || tool === "laser" || tool === "hand") && (
            <span className="text-xs" style={{ color:"var(--brown-light)" }}>
              {tool==="select" ? "Клик — выбрать · Тащить — переместить · Двойной клик на фрейме — редактировать" : tool==="hand" ? "Тащи или Пробел" : "Указка исчезает через 2.5с"}
            </span>
          )}
          {tool === "frame" && (
            <div className="flex items-center gap-2 flex-wrap">
              <label className="relative w-6 h-6 rounded-full border-2 overflow-hidden cursor-pointer"
                style={{ borderColor:"var(--brown-pale)", background: frameColor }} title="Цвет рамки">
                <input type="color" value={frameColor} onChange={e => setFrameColor(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
              </label>
              <label className="relative w-6 h-6 rounded border-2 overflow-hidden cursor-pointer"
                style={{ borderColor:"var(--brown-pale)", background: frameFill }} title="Заливка">
                <input type="color" value={frameFill} onChange={e => setFrameFill(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
              </label>
              <label className="relative w-6 h-6 rounded border-2 overflow-hidden cursor-pointer"
                style={{ borderColor:"var(--brown-pale)", background: frameTextColor }} title="Цвет текста">
                <input type="color" value={frameTextColor} onChange={e => setFrameTextColor(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
              </label>
              <Sep/>
              <select value={frameFontSize} onChange={e => setFrameFontSize(+e.target.value)}
                className="text-xs px-1.5 py-1 rounded border outline-none w-14"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                {[10,12,14,16,18,20,24,28,32].map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color:"var(--brown-light)" }}>↔</span>
                {[1,2,3,5,8].map(w => (
                  <button key={w} onClick={() => setFrameBorderWidth(w)}
                    className="rounded border-2 transition-all" title={`Толщина ${w}px`}
                    style={{ width:20,height:20, borderColor: frameBorderWidth===w?"var(--brown-dark)":"transparent", opacity: frameBorderWidth===w?1:0.4 }}>
                    <div className="mx-auto rounded" style={{ height:w, background:"#555", marginTop:(10-w)/2 }}/>
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color:"var(--brown-light)" }}>Прозр.</span>
                <input type="range" min={10} max={100} step={5} value={frameOpacity}
                  onChange={e => setFrameOpacity(+e.target.value)}
                  className="w-16 h-1.5 rounded cursor-pointer accent-stone-700"/>
                <span className="text-xs w-8 tabular-nums" style={{ color:"var(--brown-mid)" }}>{frameOpacity}%</span>
              </div>
            </div>
          )}
          {(tool === "pen" || tool === "eraser" || tool === "highlight" || tool === "shape") && (
            <div className="flex gap-1">
              {SIZES.map(s => (
                <button key={s} onClick={() => setSize(s)} className="flex items-center justify-center rounded-full border-2 transition-all"
                  style={{ width:26, height:26, borderColor: size===s?"var(--brown-dark)":"transparent", opacity: size===s?1:0.4 }}>
                  <div className="rounded-full bg-gray-800" style={{ width:s+2, height:s+2 }} />
                </button>
              ))}
            </div>
          )}
          {(tool === "shape") && <ColorPalette colors={COLORS} active={color} onPick={setColor}/>}
          {(tool === "pen" || tool === "highlight" || tool === "shape") && (<><Sep/>
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color:"var(--brown-light)" }}>Прозр.</span>
              <input type="range" min={10} max={100} step={5} value={opacity}
                onChange={e => setOpacity(+e.target.value)}
                className="w-20 h-1.5 rounded cursor-pointer accent-stone-700" />
              <span className="text-xs w-8 tabular-nums" style={{ color:"var(--brown-mid)" }}>{opacity}%</span>
            </div>
          </>)}
          {tool === "text" && (<>
            <ColorPalette colors={COLORS} active={color} onPick={setColor} />
            <Sep/>
            <select value={fontIdx} onChange={e => setFontIdx(+e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border outline-none"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              {FONTS.map((f,i) => <option key={i} value={i}>{f.label}</option>)}
            </select>
            <select value={fontSize} onChange={e => setFontSize(+e.target.value)}
              className="text-xs px-2 py-1 rounded-lg border outline-none w-16"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              {[10,12,14,16,18,20,24,28,32,36,40,48,64,80].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <Sep/>
            <button onClick={() => setBold(b=>!b)} className="w-7 h-7 rounded-lg border-2 text-sm font-bold"
              style={{ borderColor:bold?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity:bold?1:0.45 }}>B</button>
            <button onClick={() => setItalic(i=>!i)} className="w-7 h-7 rounded-lg border-2 text-sm italic"
              style={{ borderColor:italic?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity:italic?1:0.45, fontFamily:"Georgia,serif" }}>I</button>
            <Sep/>
            {(["left","center","right"] as TextAlign[]).map(a => (
              <button key={a} onClick={() => setAlign(a)}
                className="w-7 h-7 rounded-lg border-2 flex items-center justify-center"
                style={{ borderColor: align===a?"var(--brown-dark)":"var(--brown-pale)", opacity: align===a?1:0.4 }}>
                <svg width={14} height={12} viewBox="0 0 14 12">
                  {a==="left"   && <><line x1={0} y1={2}  x2={14} y2={2}  stroke="currentColor" strokeWidth={1.5}/><line x1={0} y1={6}  x2={9}  y2={6}  stroke="currentColor" strokeWidth={1.5}/><line x1={0} y1={10} x2={12} y2={10} stroke="currentColor" strokeWidth={1.5}/></>}
                  {a==="center" && <><line x1={0} y1={2}  x2={14} y2={2}  stroke="currentColor" strokeWidth={1.5}/><line x1={2.5} y1={6} x2={11.5} y2={6} stroke="currentColor" strokeWidth={1.5}/><line x1={1} y1={10} x2={13} y2={10} stroke="currentColor" strokeWidth={1.5}/></>}
                  {a==="right"  && <><line x1={0} y1={2}  x2={14} y2={2}  stroke="currentColor" strokeWidth={1.5}/><line x1={5} y1={6}  x2={14} y2={6}  stroke="currentColor" strokeWidth={1.5}/><line x1={2} y1={10} x2={14} y2={10} stroke="currentColor" strokeWidth={1.5}/></>}
                </svg>
              </button>
            ))}
            <Sep/>
            <div className="flex items-center gap-1.5">
              <label className="relative w-6 h-6 rounded-md border-2 overflow-hidden cursor-pointer"
                style={{ borderColor:"var(--brown-pale)", background: textBgOpacity>0 ? textBgColor : "transparent" }}
                title="Фон текста">
                <input type="color" value={textBgColor}
                  onChange={e => { setTextBgColor(e.target.value); if(textBgOpacity===0) setTextBgOpacity(80); }}
                  className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
              </label>
              <input type="range" min={0} max={100} step={5} value={textBgOpacity}
                onChange={e => setTextBgOpacity(+e.target.value)}
                className="w-14 h-1.5 rounded cursor-pointer accent-stone-700" title="Прозрачность фона" />
              <span className="text-xs" style={{ color:"var(--brown-light)" }}>фон</span>
            </div>
          </>)}

          </div>{/* end left scrollable zone */}

          {/* Right side: ruling + pdf + zoom + undo/redo + clear — always visible */}
          <div className="flex items-center gap-1 px-2 py-1.5 shrink-0 border-l" style={{ borderColor:"var(--brown-pale)" }}>
            <button onClick={undo} disabled={!canUndo} title="Ctrl+Z" className="p-1.5 rounded-lg border disabled:opacity-25" style={{ borderColor:"var(--brown-pale)" }}><Undo2 size={14} style={{ color:"var(--brown-dark)" }}/></button>
            <button onClick={redo} disabled={!canRedo} title="Ctrl+Y" className="p-1.5 rounded-lg border disabled:opacity-25" style={{ borderColor:"var(--brown-pale)" }}><Redo2 size={14} style={{ color:"var(--brown-dark)" }}/></button>
            <Sep/>
            <div className="flex gap-0.5">
              {RULING_OPTIONS.map(({ v, title }) => (
                <button key={v} onClick={() => setRuling(v)} title={title}
                  className="flex items-center justify-center rounded-lg border-2 transition-all"
                  style={{ width:28, height:28, borderColor: ruling===v?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity: ruling===v?1:0.4 }}>
                  <RulingIcon v={v}/>
                </button>
              ))}
            </div>
            {(ruling === "lines" || ruling === "grid" || ruling === "calligraphy") && (
              <div className="flex gap-0.5 ml-0.5">
                {(["S","M","L"] as RulingSize[]).map(sz => (
                  <button key={sz} onClick={() => setSzRuling(sz)} title={sz==="S"?"Мелко":sz==="L"?"Крупно":"Средне"}
                    className="text-xs font-bold rounded border-2 transition-all"
                    style={{ width:22, height:22, borderColor: rulingSize===sz?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity: rulingSize===sz?1:0.4 }}>
                    {sz}
                  </button>
                ))}
              </div>
            )}
            {/* LaTeX формула */}
            {!profileHide.has("formula") && (
              <div className="relative">
                <button onClick={() => { setShowFormulaPanel(p => !p); setShowCodePanel(false); }}
                  title="Вставить формулу LaTeX"
                  className="text-xs font-bold px-2 py-1 rounded-lg border-2"
                  style={{ borderColor: showFormulaPanel?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", background: showFormulaPanel?"var(--brown-pale)":"white" }}>
                  ∑
                </button>
                {showFormulaPanel && (
                  <div className="absolute top-full mt-1 right-0 z-30 bg-white rounded-xl border shadow-lg p-2"
                    style={{ borderColor:"var(--brown-pale)", minWidth:320 }}>
                    <div className="text-xs mb-1.5" style={{ color:"var(--brown-mid)" }}>LaTeX-формула. Например: \frac{"{a}{b}"}, x^2+y^2</div>
                    <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); addFormulaToBoard(); }}>
                      <input value={formulaInput} onChange={e => setFormulaInput(e.target.value)}
                        placeholder="\frac{a}{b}, \int_0^1 x\,dx" autoFocus autoComplete="off" spellCheck={false}
                        className="text-sm font-mono px-2 py-1 rounded-lg border outline-none flex-1"
                        style={{ borderColor:"var(--brown-pale)", background:"#fdf8f0", color:"var(--brown-dark)" }}/>
                      <button type="submit" disabled={!formulaInput.trim()}
                        className="text-sm px-3 py-1 rounded-lg font-medium shrink-0 disabled:opacity-40"
                        style={{ background:"var(--gradient-primary)", color:"white" }}>
                        Добавить
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
            {/* Код */}
            {!profileHide.has("code") && (
              <div className="relative">
                <button onClick={() => { setShowCodePanel(p => !p); setShowFormulaPanel(false); }}
                  title="Вставить блок кода"
                  className="text-xs font-bold px-2 py-1 rounded-lg border-2 font-mono"
                  style={{ borderColor: showCodePanel?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", background: showCodePanel?"var(--brown-pale)":"white" }}>
                  {"</>"}
                </button>
                {showCodePanel && (
                  <div className="absolute top-full mt-1 right-0 z-30 bg-white rounded-xl border shadow-lg p-2"
                    style={{ borderColor:"var(--brown-pale)", minWidth:360 }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs" style={{ color:"var(--brown-mid)" }}>Язык:</span>
                      {(["python","javascript","sql","cpp"] as const).map(l => (
                        <button key={l} onClick={() => setCodeLang(l)}
                          className="text-xs px-2 py-0.5 rounded border"
                          style={{ borderColor: codeLang===l?"var(--brown-dark)":"var(--brown-pale)", fontWeight: codeLang===l?600:400, background: codeLang===l?"var(--brown-pale)":"transparent", color:"var(--brown-dark)" }}>
                          {l}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={e => { e.preventDefault(); addCodeToBoard(); }}>
                      <textarea value={codeInput} onChange={e => setCodeInput(e.target.value)}
                        placeholder="# код здесь" autoFocus rows={5} spellCheck={false}
                        className="w-full text-xs font-mono px-2 py-1.5 rounded-lg border outline-none resize-none"
                        style={{ borderColor:"var(--brown-pale)", background:"#f8fffe", color:"var(--brown-dark)" }}/>
                      <button type="submit" disabled={!codeInput.trim()}
                        className="mt-1 text-sm px-3 py-1 rounded-lg font-medium disabled:opacity-40"
                        style={{ background:"var(--gradient-primary)", color:"white" }}>
                        Добавить
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
            {/* f(x) button — вставить график */}
            <div className="relative">
              <button onClick={() => setShowFnPanel(p => !p)}
                title="Вставить график функции (y = x², sin(x), 2x+1…)"
                className="text-xs font-bold px-2 py-1 rounded-lg border-2 font-mono"
                style={{ borderColor: showFnPanel?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", background: showFnPanel?"var(--brown-pale)":"white" }}>
                f(x)
              </button>
              {showFnPanel && (
                <div className="absolute top-full mt-1 right-0 z-30 bg-white rounded-xl border shadow-lg p-2"
                  style={{ borderColor:"var(--brown-pale)", minWidth:280 }}>
                  <div className="text-xs mb-1.5" style={{ color:"var(--brown-mid)" }}>
                    График вставляется как объект — можно двигать и масштабировать
                  </div>
                  <form className="flex items-center gap-1" onSubmit={e => { e.preventDefault(); addFunction(); setShowFnPanel(false); }}>
                    <span className="text-sm font-mono shrink-0" style={{ color:"var(--brown-mid)" }}>y =</span>
                    <input value={fnFormula} onChange={e => { setFnFormula(e.target.value); setFnError(false); }}
                      placeholder="x², sin(x), 2x+1…" autoComplete="off" spellCheck={false} autoFocus
                      className="text-sm font-mono px-2 py-1 rounded-lg border outline-none flex-1"
                      style={{ borderColor: fnError ? "#e05050" : "var(--brown-pale)", background:"#fdf8f0", color:"var(--brown-dark)" }}/>
                    <button type="submit" disabled={!fnFormula.trim()}
                      className="text-sm px-3 py-1 rounded-lg font-medium shrink-0 disabled:opacity-40"
                      style={{ background:"var(--gradient-primary)", color:"white" }}>
                      Добавить
                    </button>
                  </form>
                  {fnError && <div className="text-xs mt-1" style={{ color:"#e05050" }}>Неверная формула. Примеры: x^2, sin(x), 2*x+1</div>}
                </div>
              )}
            </div>
            <Sep/>
            {pdfMaterials.length > 0 && role === "tutor" && (
              <div className="relative">
                <button onClick={() => setShowPdfPick(p=>!p)}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border-2 font-medium"
                  style={{ borderColor: showPdfPick||pdf?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", background:pdf?"var(--brown-pale)":"white" }}>
                  <BookOpen size={13}/>{pdf && <span className="opacity-60">{pdf.page}/{pdf.total}</span>}
                </button>
                {showPdfPick && (
                  <><div className="fixed inset-0 z-10" onClick={() => setShowPdfPick(false)}/>
                  <div className="absolute top-full right-0 mt-1 z-20 w-64 rounded-xl border shadow-xl overflow-hidden"
                    style={{ background:"white", borderColor:"var(--brown-pale)" }}>
                    {pdfMaterials.map(m => (
                      <button key={m.id} onClick={() => { setShowPdfPick(false); openPdfPicker(m.file_url!); }}
                        className="w-full text-left px-3 py-2 text-sm hover:opacity-80 border-b last:border-0 flex items-center gap-2"
                        style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                        <span>📄</span><span className="truncate">{m.title}</span>
                      </button>
                    ))}
                  </div></>
                )}
              </div>
            )}
            {pdf && role==="student" && (
              <>
                <button onClick={() => goPage(-1)} disabled={pdf.page<=1||pdfLoading} className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor:"var(--brown-pale)" }}><ChevronLeft size={13} style={{ color:"var(--brown-dark)" }}/></button>
                <span className="text-xs tabular-nums" style={{ color:"var(--brown-mid)" }}>{pdfLoading?"...":pdf.page+"/"+pdf.total}</span>
                <button onClick={() => goPage(1)} disabled={pdf.page>=pdf.total||pdfLoading} className="p-1.5 rounded-lg border disabled:opacity-30" style={{ borderColor:"var(--brown-pale)" }}><ChevronRight size={13} style={{ color:"var(--brown-dark)" }}/></button>
                <button onClick={closePdf} className="p-1.5 rounded-lg border" style={{ borderColor:"var(--brown-pale)", color:"#c06040" }}><X size={12}/></button>
              </>
            )}
            <Sep/>
            <button onClick={() => zoomCenter(1/1.25)} className="p-1.5 rounded-lg border" style={{ borderColor:"var(--brown-pale)" }}><ZoomOut size={13} style={{ color:"var(--brown-dark)" }}/></button>
            <span className="text-xs w-9 text-center tabular-nums" style={{ color:"var(--brown-mid)" }}>{vpZoom}%</span>
            <button onClick={() => zoomCenter(1.25)} className="p-1.5 rounded-lg border" style={{ borderColor:"var(--brown-pale)" }}><ZoomIn size={13} style={{ color:"var(--brown-dark)" }}/></button>
            <button onClick={fitAll} title="Показать всё содержимое" className="p-1.5 rounded-lg border" style={{ borderColor:"var(--brown-pale)" }}><Minimize2 size={13} style={{ color:"var(--brown-dark)" }}/></button>
            <button onClick={() => applyView(1,0,0)} title="Домой (сброс вида)" className="p-1.5 rounded-lg border" style={{ borderColor:"var(--brown-pale)" }}><Maximize2 size={13} style={{ color:"var(--brown-dark)" }}/></button>
            <button onClick={() => setSnapGrid(v => !v)}
              title={snapGrid ? "Привязка к сетке: ВКЛ — карандаш и фигуры прилипают к узлам сетки. Нажмите, чтобы выключить" : "Привязка к сетке: ВЫКЛ — включить, чтобы карандаш и фигуры прилипали к узлам сетки"}
              className="p-1.5 rounded-lg border-2 transition-all"
              style={{ borderColor: snapGrid ? "var(--brown-dark)" : "var(--brown-pale)", background: snapGrid ? "var(--brown-pale)" : "white", color: "var(--brown-dark)" }}>
              <Magnet size={13}/>
            </button>
            <Sep/>
            {role==="tutor" && (
              <>
                <button onClick={bringToMe} title="Перенести ученика ко мне" className="p-1.5 rounded-lg border-2"
                  style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}>
                  <Navigation size={13}/>
                </button>
                <button onClick={findStudent} disabled={!hasRemoteViewport}
                  title="Найти ученика — перейти к его позиции на доске"
                  className="p-1.5 rounded-lg border-2 disabled:opacity-30"
                  style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}>
                  <LocateFixed size={13}/>
                </button>
                <button onClick={() => lockAll(true)} title="Заблокировать все элементы"
                  className="p-1.5 rounded-lg border"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <LockKeyhole size={13}/>
                </button>
                <button onClick={() => lockAll(false)} title="Разблокировать все элементы"
                  className="p-1.5 rounded-lg border"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <LockKeyholeOpen size={13}/>
                </button>
                {students.length > 0 && (
                  <>
                    <button
                      onClick={() => {
                        const cols = Math.min(students.length, 3);
                        const fw = 280, fh = 200, gap = 24;
                        const totalW = cols * fw + (cols - 1) * gap;
                        const { zoom: vz, panX: vpx, panY: vpy } = viewRef.current;
                        const canvas = canvasRef.current;
                        const vw = (canvas?.offsetWidth ?? 800) / vz;
                        const vh = (canvas?.offsetHeight ?? 600) / vz;
                        const sx = -vpx / vz + (vw - totalW) / 2;
                        const sy = -vpy / vz + (vh - Math.ceil(students.length / cols) * (fh + gap)) / 2;
                        students.forEach((s, i) => {
                          const col = i % cols, row = Math.floor(i / cols);
                          const oc = FRAME_COLORS[i % FRAME_COLORS.length];
                          const item: FrameItem = {
                            type:"frame", id:uid(),
                            x: sx + col * (fw + gap), y: sy + row * (fh + gap),
                            w: fw, h: fh, shape:"rounded", title: s.name,
                            color: oc, bgColor: oc + "22",
                            ownerName: s.name, ownerColor: oc, ownerStudentId: s.id,
                            private: true, borderWidth: 2,
                          };
                          itemsRef.current.push(item);
                          send({ type:"path", item });
                        });
                        privacyModeRef.current = true;
                        setPrivacyMode(true);
                        send({ type:"privacy_mode", enabled: true });
                        render();
                      }}
                      title="Создать личный фрейм для каждого ученика группы"
                      className="text-xs px-2 py-1 rounded-lg font-medium border"
                      style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)", background:"transparent" }}>
                      + Фреймы
                    </button>
                    {privacyMode ? (
                      <button
                        onClick={() => {
                          itemsRef.current = itemsRef.current.map(it =>
                            it.type === "frame" && (it as FrameItem).private ? { ...it, private: false } : it
                          ) as DrawItem[];
                          privacyModeRef.current = false;
                          setPrivacyMode(false);
                          send({ type: "reveal_all" });
                          render();
                        }}
                        title="Показать всем — открыть все приватные фреймы"
                        className="text-xs px-2 py-1 rounded-lg font-medium"
                        style={{ background:"#fff8e0", color:"#c07020", border:"1px solid #c07020" }}>
                        Показать всем
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          itemsRef.current = itemsRef.current.map(it =>
                            it.type === "frame" && (it as FrameItem).ownerStudentId ? { ...it, private: true } : it
                          ) as DrawItem[];
                          privacyModeRef.current = true;
                          setPrivacyMode(true);
                          send({ type: "hide_all" });
                          render();
                        }}
                        title="Скрыть ответы — личные фреймы видны только владельцам"
                        className="text-xs px-2 py-1 rounded-lg font-medium border"
                        style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)", background:"transparent" }}>
                        Скрыть ответы
                      </button>
                    )}
                  </>
                )}
              </>
            )}
            <button title="Очистить доску — двойной клик" onDoubleClick={handleClear} onClick={()=>{}}
              className="p-1.5 rounded-lg border hover:bg-red-50"
              style={{ borderColor:"var(--brown-pale)" }}>
              <Trash2 size={13} style={{ color:"#c06040" }}/>
            </button>
            <div className="flex items-center gap-1 text-xs" style={{ color:connected?"#4a8a4a":"#aaa" }}>
              <div className="w-2 h-2 rounded-full" style={{ background:connected?"#4a8a4a":"#ccc" }}/>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div ref={containerRef} className="flex-1 relative overflow-hidden"
        style={{ background:"#e8e8e8", cursor, touchAction:"none" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => {
          panning.current=false; livePathRef.current=null; selDragRef.current=null;
          eraserActiveRef.current=false; setEraserPos(null);
          if (selBoxRef.current) { selBoxRef.current=null; setSelBoxVis(false); }
          if (multiDragRef.current) { multiDragRef.current=null; }
        }}
        onDoubleClick={e => {
          // Double-click on empty canvas → create text (works in select & text tools)
          if (tool !== "select" && tool !== "text") return;
          if (textInput) return;
          const { cx, cy } = clientXY(e as unknown as React.MouseEvent);
          const w = s2w(cx, cy);
          const hit = [...itemsRef.current].reverse().find(item => hitTest(item, w.x, w.y));
          if (hit) return; // let item handle its own dblclick
          setTextInput({ wx: w.x, wy: w.y }); setTextValue("");
          setTimeout(() => textRef.current?.focus(), 30);
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={() => {
          selDragRef.current = null; setTouchDragging(false);
          livePathRef.current = null; liveShapeRef.current = null; liveFrameRef.current = null;
          panning.current = false; eraserActiveRef.current = false;
          touchDrawPending.current = null;
          render();
        }}>

        <canvas ref={canvasRef} className="absolute inset-0" style={{ touchAction:"none" }} />

        {/* Video overlays */}
        {itemsRef.current.filter(it => it.type === "video").map(it => {
          const vi = it as VideoItem;
          const sp = w2s(vi.x, vi.y);
          const ep = w2s(vi.x + vi.w, vi.y + vi.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const selected = selectedId === vi.id || selectedIds.has(vi.id);
          const locked = vi.locked;
          const isDraggingThis = touchDragging && selectedId === vi.id;
          return (
            <div key={vi.id} className="absolute"
              style={{ left: sp.x, top: sp.y, width: sw, height: sh, zIndex: 20,
                visibility: isDraggingThis ? "hidden" : undefined }}
              onMouseDown={e => {
                e.stopPropagation();
                setSelectedId(vi.id); setSelectedIds(new Set([vi.id]));
                if (!vi.locked) {
                  const { cx, cy } = clientXY(e);
                  const wp = s2w(cx, cy);
                  selDragRef.current = { mode: "move", id: vi.id, wx0: wp.x, wy0: wp.y, origItem: { ...vi } };
                }
              }}>
              <div className="w-full h-full overflow-hidden relative"
                style={{ outline: selected ? "2px solid #4a80f0" : undefined }}>
                <video src={vi.url} controls className="w-full h-full object-contain bg-black"
                  style={{ display:"block" }}
                  ref={el => { if (el) videosRef.current.set(vi.id, el); else videosRef.current.delete(vi.id); }}
                  onPlay={role === "tutor" ? e => {
                    send({ type: "video_sync", id: vi.id, action: "play", position: e.currentTarget.currentTime, sentAt: Date.now() });
                  } : undefined}
                  onPause={role === "tutor" ? e => {
                    const v = e.currentTarget;
                    if (!v.ended) send({ type: "video_sync", id: vi.id, action: "pause", position: v.currentTime, sentAt: Date.now() });
                  } : undefined}
                  onSeeked={role === "tutor" ? e => {
                    const pos = e.currentTarget.currentTime;
                    const id  = vi.id;
                    const t   = videoSeekTimerRef.current.get(id);
                    if (t) clearTimeout(t);
                    videoSeekTimerRef.current.set(id, setTimeout(() => {
                      videoSeekTimerRef.current.delete(id);
                      send({ type: "video_sync", id, action: "seek", position: pos, sentAt: Date.now() });
                    }, 200));
                  } : undefined}
                />
                {/* Student sync overlay — appears on tutor's play event, dismissed by user gesture */}
                {role === "student" && pendingVideoSync.has(vi.id) && (
                  <button
                    className="absolute inset-0 flex flex-col items-center justify-center gap-2"
                    style={{ background: "rgba(0,0,0,0.70)", color: "white", zIndex: 3, border: "none", cursor: "pointer" }}
                    onClick={() => {
                      const p = pendingVideoSync.get(vi.id);
                      if (!p) return;
                      const vid = videosRef.current.get(vi.id);
                      if (vid) {
                        vid.currentTime = Math.max(0, p.position + (Date.now() - p.sentAt) / 1000);
                        vid.play().catch(() => {});
                      }
                      setPendingVideoSync(prev => { const m = new Map(prev); m.delete(vi.id); return m; });
                    }}>
                    <svg viewBox="0 0 24 24" fill="currentColor" width={44} height={44}><path d="M8 5v14l11-7z"/></svg>
                    <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: 0.2 }}>Готов смотреть</span>
                  </button>
                )}
              </div>
              {/* Fullscreen button */}
              <button
                onClick={() => setFullscreenVideo(vi.url)}
                className="absolute bottom-1 right-1 p-1 rounded text-white"
                style={{ background:"rgba(0,0,0,0.55)", lineHeight:1, zIndex:2 }}
                title="Во весь экран">
                <Maximize2 size={12}/>
              </button>
              {/* Resize handles */}
              {selected && !locked && !touchDragging && (["nw","ne","sw","se"] as const).map(corner => {
                const isRight = corner.endsWith("e"), isBottom = corner.startsWith("s");
                const startResize = (clientX: number, clientY: number) => {
                  const rect = containerRef.current!.getBoundingClientRect();
                  const ww = (clientX - rect.left - viewRef.current.panX) / viewRef.current.zoom;
                  const wh = (clientY - rect.top  - viewRef.current.panY) / viewRef.current.zoom;
                  selDragRef.current = { mode:"resize-img", id: vi.id, corner, wx0: ww, wy0: wh, origItem: { ...vi } };
                };
                return (
                  <div key={corner} className="absolute pointer-events-auto"
                    style={{
                      [isRight?"right":"left"]: -7, [isBottom?"bottom":"top"]: -7,
                      width:18, height:18, cursor:`${corner}-resize`, zIndex:32,
                      background:"white", border:"2px solid #4a80f0", borderRadius:3,
                    }}
                    onMouseDown={e => { e.stopPropagation(); startResize(e.clientX, e.clientY); }}
                    onTouchStart={e => { e.stopPropagation(); e.preventDefault(); startResize(e.touches[0].clientX, e.touches[0].clientY); }}
                  />
                );
              })}
            </div>
          );
        })}

        {/* Function graph overlays — selection border + resize handles */}
        {itemsRef.current.filter(it => it.type === "function").map(it => {
          const fi = it as FunctionItem;
          const sp = w2s(fi.x, fi.y);
          const ep = w2s(fi.x + fi.w, fi.y + fi.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const selected = selectedId === fi.id || selectedIds.has(fi.id);
          return (
            <div key={fi.id} className="absolute pointer-events-none"
              style={{ left: sp.x, top: sp.y, width: sw, height: sh, zIndex: 18 }}>
              {selected && !touchDragging && (
                <>
                  <div className="absolute inset-0" style={{ outline: "2px solid #4a80f0" }} />
                  {!fi.locked && (["nw","ne","sw","se"] as const).map(corner => {
                    const isRight = corner.endsWith("e"), isBottom = corner.startsWith("s");
                    return (
                      <div key={corner} className="absolute pointer-events-auto"
                        style={{
                          [isRight?"right":"left"]: -7, [isBottom?"bottom":"top"]: -7,
                          width:14, height:14, cursor:`${corner}-resize`, zIndex:32,
                          background:"white", border:"2px solid #4a80f0", borderRadius:3,
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const rect = containerRef.current!.getBoundingClientRect();
                          const ww = (e.clientX - rect.left - viewRef.current.panX) / viewRef.current.zoom;
                          const wh = (e.clientY - rect.top - viewRef.current.panY) / viewRef.current.zoom;
                          selDragRef.current = { mode:"resize-img", id: fi.id, corner,
                            wx0: ww, wy0: wh, origItem: { ...fi } };
                        }}/>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}

        {/* Formula overlays */}
        {itemsRef.current.filter(it => it.type === "formula").map(it => {
          const fi = it as FormulaItem;
          const sp = w2s(fi.x, fi.y), ep = w2s(fi.x + fi.w, fi.y + fi.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const selected = selectedId === fi.id || selectedIds.has(fi.id);
          const isDraggingThis = touchDragging && selectedId === fi.id;
          return (
            <div key={fi.id} className="absolute overflow-hidden"
              style={{ left: sp.x, top: sp.y, width: sw, height: sh, zIndex: 20,
                background: "rgba(237,233,254,0.95)", border: selected ? "2px solid #7c3aed" : "1.5px solid #c4b5fd",
                borderRadius: 6, cursor: "grab", visibility: isDraggingThis ? "hidden" : undefined }}
              onMouseDown={e => {
                e.stopPropagation();
                setSelectedId(fi.id); setSelectedIds(new Set([fi.id]));
                if (!fi.locked) {
                  const { cx, cy } = clientXY(e);
                  const wp = s2w(cx, cy);
                  selDragRef.current = { mode: "move", id: fi.id, wx0: wp.x, wy0: wp.y, origItem: { ...fi } };
                }
              }}>
              <FormulaRenderer latex={fi.latex} color={fi.color} fontSize={fi.fontSize} />
              {selected && !fi.locked && !touchDragging && (["nw","ne","sw","se"] as const).map(corner => {
                const isRight = corner.endsWith("e"), isBottom = corner.startsWith("s");
                return (
                  <div key={corner} className="absolute pointer-events-auto"
                    style={{ [isRight?"right":"left"]: -9, [isBottom?"bottom":"top"]: -9,
                      width:18, height:18, cursor:`${corner}-resize`, zIndex:32,
                      background:"white", border:"2px solid #7c3aed", borderRadius:3 }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const r = containerRef.current!.getBoundingClientRect();
                      const ww = (e.clientX - r.left - viewRef.current.panX) / viewRef.current.zoom;
                      const wh = (e.clientY - r.top  - viewRef.current.panY) / viewRef.current.zoom;
                      selDragRef.current = { mode:"resize-img", id: fi.id, corner, wx0: ww, wy0: wh, origItem: { ...fi } };
                    }}/>
                );
              })}
            </div>
          );
        })}

        {/* Code overlays */}
        {itemsRef.current.filter(it => it.type === "code").map(it => {
          const ci = it as CodeItem;
          const sp = w2s(ci.x, ci.y), ep = w2s(ci.x + ci.w, ci.y + ci.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const selected = selectedId === ci.id || selectedIds.has(ci.id);
          const isDraggingThis = touchDragging && selectedId === ci.id;
          return (
            <div key={ci.id} className="absolute overflow-hidden"
              style={{ left: sp.x, top: sp.y, width: sw, height: sh, zIndex: 20,
                background: "rgba(220,252,231,0.97)", border: selected ? "2px solid #16a34a" : "1.5px solid #86efac",
                borderRadius: 6, cursor: "grab", visibility: isDraggingThis ? "hidden" : undefined }}
              onMouseDown={e => {
                e.stopPropagation();
                setSelectedId(ci.id); setSelectedIds(new Set([ci.id]));
                if (!ci.locked) {
                  const { cx, cy } = clientXY(e);
                  const wp = s2w(cx, cy);
                  selDragRef.current = { mode: "move", id: ci.id, wx0: wp.x, wy0: wp.y, origItem: { ...ci } };
                }
              }}>
              <CodeRenderer content={ci.content} language={ci.language} />
              {selected && !ci.locked && !touchDragging && (["nw","ne","sw","se"] as const).map(corner => {
                const isRight = corner.endsWith("e"), isBottom = corner.startsWith("s");
                return (
                  <div key={corner} className="absolute pointer-events-auto"
                    style={{ [isRight?"right":"left"]: -9, [isBottom?"bottom":"top"]: -9,
                      width:18, height:18, cursor:`${corner}-resize`, zIndex:32,
                      background:"white", border:"2px solid #16a34a", borderRadius:3 }}
                    onMouseDown={e => {
                      e.stopPropagation();
                      const r = containerRef.current!.getBoundingClientRect();
                      const ww = (e.clientX - r.left - viewRef.current.panX) / viewRef.current.zoom;
                      const wh = (e.clientY - r.top  - viewRef.current.panY) / viewRef.current.zoom;
                      selDragRef.current = { mode:"resize-img", id: ci.id, corner, wx0: ww, wy0: wh, origItem: { ...ci } };
                    }}/>
                );
              })}
            </div>
          );
        })}

        {/* Dice board overlays */}
        {itemsRef.current.filter(it => it.type === "dice").map(it => {
          const di = it as DiceItem;
          const sp = w2s(di.x, di.y);
          const ep = w2s(di.x + di.w, di.y + di.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const sel = selectedId === di.id || selectedIds.has(di.id);
          if (touchDragging && selectedId === di.id) return null;
          return (
            <DiceOverlay key={di.id} item={di} sp={sp} sw={sw} sh={sh} selected={sel}
              onRoll={result => updateBoardItem({ ...di, result })} />
          );
        })}

        {/* Wheel board overlays */}
        {itemsRef.current.filter(it => it.type === "wheel").map(it => {
          const wi = it as WheelItem;
          const sp = w2s(wi.x, wi.y);
          const ep = w2s(wi.x + wi.w, wi.y + wi.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const sel = selectedId === wi.id || selectedIds.has(wi.id);
          if (touchDragging && selectedId === wi.id) return null;
          return (
            <WheelOverlay key={wi.id} item={wi} sp={sp} sw={sw} sh={sh} selected={sel}
              onAngleUpdate={angle => updateBoardItem({ ...wi, angle })}
              onEdit={() => { setEditWheelId(wi.id); setEditWheelText(wi.items.join("\n")); }} />
          );
        })}

        {/* Table board overlays */}
        {itemsRef.current.filter(it => it.type === "table").map(it => {
          const ti = it as TableItem;
          const sp = w2s(ti.x, ti.y);
          const ep = w2s(ti.x + ti.w, ti.y + ti.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          const sel = selectedId === ti.id || selectedIds.has(ti.id);
          return (
            <TableOverlay key={ti.id} item={ti} sp={sp} sw={sw} sh={sh} selected={sel}
              zoom={viewRef.current.zoom}
              onCellChange={(r, c, text) => {
                const newData = ti.data.map(row => [...row]);
                newData[r][c] = text;
                updateBoardItem({ ...ti, data: newData });
              }} />
          );
        })}

        {/* Laser */}
        {laserScr  && <LaserDot sx={laserScr.x}  sy={laserScr.y}  color="#ff3030"/>}
        {ownLaserS && tool==="laser" && <LaserDot sx={ownLaserS.x} sy={ownLaserS.y} color="#ff6600"/>}

        {/* Eraser cursor */}
        {tool === "eraser" && eraserPos && (
          <div className="absolute pointer-events-none rounded-full border-2"
            style={{
              left: eraserPos.sx - size * 3,
              top:  eraserPos.sy - size * 3,
              width:  size * 6, height: size * 6,
              borderColor: "#e05030",
              background: "rgba(255,100,60,0.08)",
            }}/>
        )}

        {/* Remote cursor */}
        {remoteScr && (
          <div className="absolute pointer-events-none" style={{ left:remoteScr.x-6, top:remoteScr.y-6 }}>
            <div className="w-3 h-3 rounded-full border-2 border-white shadow-md"
              style={{ background:role==="tutor"?"#5555e0":"#e05020" }}/>
            <div className="text-white text-center rounded px-1 mt-0.5 whitespace-nowrap"
              style={{ fontSize:9, background:role==="tutor"?"#5555e0":"#e05020", lineHeight:"14px" }}>
              {role==="tutor"?"Ученик":"Репетитор"}
            </div>
          </div>
        )}

        {/* Pending symbol cursor preview */}
        {pendingSymbol && pendingSymbolPos && (
          <div className="absolute pointer-events-none select-none" style={{
            left: pendingSymbolPos.sx - 24, top: pendingSymbolPos.sy - 24,
            fontSize: 40, lineHeight: 1, zIndex: 50, opacity: 0.75,
            filter: "drop-shadow(0 0 4px rgba(0,0,0,0.3))",
          }}>
            {pendingSymbol}
          </div>
        )}
        {pendingSymbol && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium shadow-lg pointer-events-auto select-none"
            style={{ background:"var(--brown-dark)", color:"white", zIndex:51 }}>
            <span className="pointer-events-none">Тапни на доску чтобы разместить</span>
            <button onClick={() => { setPendingSymbol(null); setPendingSymbolPos(null); }}
              className="ml-1 text-white opacity-70 hover:opacity-100 font-bold text-sm leading-none">✕</button>
          </div>
        )}

        {/* Rubber-band selection box */}
        {selBoxVis && selBoxRef.current && (() => {
          const sb = selBoxRef.current!;
          const tl = w2s(Math.min(sb.wx1, sb.wx2), Math.min(sb.wy1, sb.wy2));
          const br = w2s(Math.max(sb.wx1, sb.wx2), Math.max(sb.wy1, sb.wy2));
          return (
            <div className="absolute pointer-events-none"
              style={{ left:tl.x, top:tl.y, width:br.x-tl.x, height:br.y-tl.y,
                border:"2px dashed #4a80f0", background:"rgba(74,128,240,0.07)",
                borderRadius:3, zIndex:28 }}/>
          );
        })()}

        {/* Multi-select group overlay */}
        {selectedIds.size > 1 && tool === "select" && (() => {
          const items = itemsRef.current.filter(i => selectedIds.has(i.id));
          if (!items.length) return null;
          let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
          for (const it of items) {
            const b = itemBounds(it);
            x0=Math.min(x0,b.x0); y0=Math.min(y0,b.y0);
            x1=Math.max(x1,b.x1); y1=Math.max(y1,b.y1);
          }
          const PAD = 10/zoom;
          const tl = w2s(x0-PAD, y0-PAD);
          const br = w2s(x1+PAD, y1+PAD);
          const sw=br.x-tl.x, sh=br.y-tl.y;
          return (
            <div className="absolute" style={{ left:tl.x, top:tl.y, width:sw, height:sh,
              border:"2px solid #4a80f0", background:"rgba(74,128,240,0.04)",
              borderRadius:4, zIndex:30 }}>
              {/* Badge + toolbar — flip below group if near top of canvas */}
              {(() => {
                const vOff = tl.y > 32 ? -28 : sh + 4;
                return (
                  <>
                    <div className="absolute pointer-events-none flex items-center gap-2"
                      style={{ top: vOff, left: 0 }}>
                      <div className="rounded-lg px-2 py-0.5 text-xs font-medium text-white flex items-center gap-1"
                        style={{ background:"#4a80f0" }}>
                        {items.length} объекта
                      </div>
                    </div>
                    <div className="absolute pointer-events-auto flex items-center gap-1"
                      style={{ top: vOff, right: 0 }}>
                      <button onMouseDown={e => e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                        onClick={() => {
                          const sel = itemsRef.current.filter(i => selectedIds.has(i.id));
                          const duped = sel.map(i => shiftItem({ ...i, id: uid() }, 24, 24));
                          duped.forEach(item => { itemsRef.current.push(item); send({ type:"path", item }); pushHistory({ type:"add", item }); });
                          render();
                        }}
                        className="rounded-lg px-2 py-0.5 text-xs font-medium flex items-center gap-1 hover:opacity-80 border"
                        style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                        ⧉ Дубль
                      </button>
                      <button onMouseDown={e => e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                        onClick={() => {
                          pushHistory({ type:"clear", saved:[...itemsRef.current] });
                          const toRemove = new Set(selectedIds);
                          itemsRef.current = itemsRef.current.filter(i => !toRemove.has(i.id));
                          render(); send({ type:"clear" });
                          itemsRef.current.forEach(item => send({ type:"path", item }));
                          setSelectedIds(new Set()); setSelectedId(null);
                        }}
                        className="rounded-lg px-2 py-0.5 text-xs font-medium text-white flex items-center gap-1 hover:opacity-80"
                        style={{ background:"#e05030" }}>
                        <Trash2 size={11}/> Удалить
                      </button>
                    </div>
                  </>
                );
              })()}
              {/* Drag hint */}
              <div className="absolute inset-0 cursor-move" style={{ zIndex:1 }}/>
            </div>
          );
        })()}

        {/* Selection overlay — hidden while touch-dragging to avoid stale DOM position */}
        {selectedItem && !touchDragging && (() => {
          const bounds = itemBounds(selectedItem);
          const PAD = 8 / zoom;
          const tl = w2s(bounds.x0 - PAD, bounds.y0 - PAD);
          const br = w2s(bounds.x1 + PAD, bounds.y1 + PAD);
          const sw = br.x - tl.x, sh = br.y - tl.y;
          const locked = !!selectedItem.locked;
          return (
            <div className="absolute pointer-events-none"
              style={{ left:tl.x, top:tl.y, width:sw, height:sh,
                border: locked ? "2px dashed #e09020" : "2px dashed #4a80f0",
                borderRadius:4, zIndex:30, touchAction:"none" }}>
              {/* Lock button — tutor only */}
              {role === "tutor" && (
                <button className="absolute pointer-events-auto flex items-center justify-center rounded"
                  style={{ left:-12, top:-12, width:28, height:28, zIndex:31, cursor:"pointer",
                    background: locked?"#e09020":"#4a80f0", border:"none" }}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => toggleLock(selectedItem.id)}>
                  {locked ? <Unlock size={13} color="white"/> : <Lock size={13} color="white"/>}
                </button>
              )}
              {/* Duplicate + Layer + Delete — desktop: bottom bar. Touch: keep floating */}
              <div className="sm:hidden absolute pointer-events-auto flex items-center gap-1"
                style={{ top: tl.y > 36 ? -28 : sh + 4, right:0, zIndex:36 }}>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => { const d=shiftItem({...selectedItem,id:uid()},24,24); itemsRef.current.push(d); send({type:"path",item:d}); pushHistory({type:"add",item:d}); render(); }}
                  className="rounded-lg px-2 py-1 text-xs font-medium border hover:opacity-80"
                  title="Дублировать"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>⧉</button>
                {selectedItem.type === "image" && (
                  <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}} onClick={() => setCropId(selectedItem.id)}
                    className="rounded-lg px-2 py-1 text-xs font-medium border hover:opacity-80"
                    title="Обрезать"
                    style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>✂</button>
                )}
                {/* Layer order buttons */}
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => reorderItem(selectedItem.id, "forward")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="Вперёд"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronUp size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => reorderItem(selectedItem.id, "backward")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="Назад"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronDown size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => reorderItem(selectedItem.id, "front")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="На передний план"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronsUp size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => reorderItem(selectedItem.id, "back")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="На задний план"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronsDown size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => {
                    const toRemove = new Set(selectedIds.size > 0 ? selectedIds : [selectedItem.id]);
                    pushHistory({ type:"clear", saved:[...itemsRef.current] });
                    itemsRef.current = itemsRef.current.filter(i => !toRemove.has(i.id));
                    render(); send({ type:"clear" });
                    itemsRef.current.forEach(item => send({ type:"path", item }));
                    setSelectedId(null);
                    setSelectedIds(new Set());
                  }}
                  className="rounded-lg px-2 py-1 text-xs font-medium text-white hover:opacity-80 flex items-center justify-center"
                  style={{ background:"#e05030", minHeight:28, minWidth:28 }}>
                  <Trash2 size={12}/>
                </button>
              </div>
              {/* Edit button — text (mobile-friendly size) */}
              {selectedItem.type === "text" && !selectedItem.isSymbol && !(selectedItem.align === "center" && [...selectedItem.text].every(c => c.codePointAt(0)! > 127)) && (
                <button className="absolute pointer-events-auto flex items-center justify-center rounded-lg"
                  style={{ right:-14, top:-14, width:34, height:34, zIndex:31, cursor:"pointer",
                    background:"#4a80f0", border:"2px solid white", boxShadow:"0 2px 8px rgba(74,128,240,0.4)" }}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                  onClick={() => {
                    const ti = selectedItem as TextItem;
                    editingIdRef.current = ti.id; setEditingId(ti.id);
                    setTextInput({ wx:ti.x, wy:ti.y }); setTextValue(ti.text);
                    setBold(ti.bold); setItalic(ti.italic); setAlign(ti.align); setFontSize(ti.fontSize);
                    const fi = FONTS.findIndex(f => f.family === ti.font); setFontIdx(fi>=0?fi:0);
                    render(); // hide original from canvas immediately
                    setTimeout(() => {
                      const ta = textRef.current; if (!ta) return;
                      ta.focus();
                      ta.dispatchEvent(new Event("input")); // trigger auto-size
                      ta.style.height = "auto"; ta.style.height = ta.scrollHeight + "px";
                    }, 30);
                  }}>
                  <Pencil size={14} color="white"/>
                </button>
              )}
              {/* Text color panel — below the selection (mobile only — desktop uses bottom bar) */}
              {selectedItem.type === "text" && !locked && (
                <div className="sm:hidden absolute pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-xl border shadow-md"
                  style={{ top: sh + 6, left: 0, background:"white", borderColor:"var(--brown-pale)", zIndex:35, whiteSpace:"nowrap" }}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}>
                  {(["#1a1a1a","#e05030","#4a80f0","#2a9d5c","#e0a020","#9b59b6","#ffffff"] as const).map(c => (
                    <button key={c}
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                      onClick={() => updateBoardItem({...selectedItem as TextItem, color: c})}
                      className="w-8 h-8 rounded-full shrink-0 border-2"
                      style={{ background: c, borderColor: (selectedItem as TextItem).color === c ? "#4a80f0" : "var(--brown-pale)" }}/>
                  ))}
                  <label className="relative w-8 h-8 rounded-full border-2 cursor-pointer overflow-hidden shrink-0"
                    title="Другой цвет"
                    style={{ borderColor:"var(--brown-pale)", background:(selectedItem as TextItem).color }}>
                    <input type="color" value={(selectedItem as TextItem).color}
                      onChange={e => updateBoardItem({...selectedItem as TextItem, color: e.target.value})}
                      className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/>
                  </label>
                </div>
              )}
              {/* Resize handle — text only */}
              {selectedItem.type === "text" && !locked && (
                <div className="absolute pointer-events-auto"
                  style={{ right:-9, bottom:-9, width:24, height:24, cursor:"se-resize",
                    background:"white", border:"2px solid #4a80f0", borderRadius:4,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:10, color:"#4a80f0", userSelect:"none",
                    touchAction:"none" }}
                  onMouseDown={e => {
                    e.stopPropagation();
                    const ti = selectedItem as TextItem;
                    const tb = textBounds(ti);
                    selDragRef.current = { mode:"resize", id:ti.id,
                      wx0: (e.clientX - containerRef.current!.getBoundingClientRect().left - viewRef.current.panX) / viewRef.current.zoom,
                      wy0: (e.clientY - containerRef.current!.getBoundingClientRect().top  - viewRef.current.panY) / viewRef.current.zoom,
                      origItem: { ...ti },
                      origFontSize: ti.fontSize,
                      origDiag: Math.max(20, Math.hypot(tb.w, tb.h)),
                    };
                  }}
                  onTouchStart={e => {
                    e.stopPropagation(); e.preventDefault();
                    const ti = selectedItem as TextItem;
                    const tb = textBounds(ti);
                    const rect = containerRef.current!.getBoundingClientRect();
                    selDragRef.current = { mode:"resize", id:ti.id,
                      wx0: (e.touches[0].clientX - rect.left - viewRef.current.panX) / viewRef.current.zoom,
                      wy0: (e.touches[0].clientY - rect.top  - viewRef.current.panY) / viewRef.current.zoom,
                      origItem: { ...ti },
                      origFontSize: ti.fontSize,
                      origDiag: Math.max(20, Math.hypot(tb.w, tb.h)),
                    };
                  }}>↘</div>
              )}
              {/* Resize handles — image and frame */}
              {(selectedItem.type === "image" || selectedItem.type === "frame") && !locked && (
                <>
                  {(["nw","ne","sw","se"] as const).map(corner => {
                    const isRight = corner.endsWith("e"), isBottom = corner.startsWith("s");
                    const mode = selectedItem.type === "image" ? "resize-img" : "resize-frame";
                    return (
                      <div key={corner} className="absolute pointer-events-auto"
                        style={{
                          [isRight?"right":"left"]: -10,
                          [isBottom?"bottom":"top"]: -10,
                          width:20, height:20, cursor:`${corner}-resize`,
                          background:"white", border:"2px solid #4a80f0", borderRadius:3, zIndex:32,
                          touchAction:"none",
                        }}
                        onMouseDown={e => {
                          e.stopPropagation();
                          const rect = containerRef.current!.getBoundingClientRect();
                          const ww = (e.clientX - rect.left - viewRef.current.panX) / viewRef.current.zoom;
                          const wh = (e.clientY - rect.top  - viewRef.current.panY) / viewRef.current.zoom;
                          selDragRef.current = { mode, id: selectedItem.id, corner,
                            wx0: ww, wy0: wh, origItem: { ...selectedItem } };
                        }}
                        onTouchStart={e => {
                          e.stopPropagation(); e.preventDefault();
                          const rect = containerRef.current!.getBoundingClientRect();
                          const ww = (e.touches[0].clientX - rect.left - viewRef.current.panX) / viewRef.current.zoom;
                          const wh = (e.touches[0].clientY - rect.top  - viewRef.current.panY) / viewRef.current.zoom;
                          selDragRef.current = { mode, id: selectedItem.id, corner,
                            wx0: ww, wy0: wh, origItem: { ...selectedItem } };
                        }}/>
                    );
                  })}
                </>
              )}
              {/* Frame properties panel (mobile only — desktop uses bottom bar) */}
              {selectedItem.type === "frame" && !locked && (
                <div className="sm:hidden absolute pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-xl shadow-lg border"
                  style={{ top: tl.y > 50 ? -44 : sh + 8, left:"50%", transform:"translateX(-50%)", background:"white",
                    borderColor:"var(--brown-pale)", whiteSpace:"nowrap", zIndex:35 }}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}>
                  {/* Border color */}
                  <label className="w-6 h-6 rounded-full border-2 cursor-pointer overflow-hidden"
                    style={{ borderColor:"var(--brown-pale)", background:(selectedItem as FrameItem).color }}
                    title="Цвет рамки">
                    <input type="color" value={(selectedItem as FrameItem).color}
                      onChange={e => { const next={...selectedItem as FrameItem, color:e.target.value}; updateBoardItem(next); }}
                      className="absolute opacity-0 w-full h-full cursor-pointer" style={{top:0,left:0}}/>
                  </label>
                  {/* Fill color */}
                  <label className="w-6 h-6 rounded-full border-2 cursor-pointer overflow-hidden"
                    style={{ borderColor:"var(--brown-pale)", background:(selectedItem as FrameItem).bgColor }}
                    title="Заливка">
                    <input type="color" value={(selectedItem as FrameItem).bgColor}
                      onChange={e => { const next={...selectedItem as FrameItem, bgColor:e.target.value}; updateBoardItem(next); }}
                      className="absolute opacity-0 w-full h-full cursor-pointer" style={{top:0,left:0}}/>
                  </label>
                  <div className="w-px h-4" style={{ background:"var(--brown-pale)" }}/>
                  {/* Opacity */}
                  <span className="text-xs" style={{ color:"var(--brown-mid)" }}>Прозрачность</span>
                  <input type="range" min={10} max={100} step={5}
                    value={(selectedItem as FrameItem).opacity ?? 100}
                    onChange={e => { const next={...selectedItem as FrameItem, opacity:+e.target.value}; updateBoardItem(next); }}
                    className="w-20 h-1 accent-blue-400"/>
                  <span className="text-xs w-7 tabular-nums" style={{ color:"var(--brown-mid)" }}>
                    {(selectedItem as FrameItem).opacity ?? 100}%
                  </span>
                  <div className="w-px h-4" style={{ background:"var(--brown-pale)" }}/>
                  {/* Private frame toggle */}
                  {(role === "tutor" || currentStudentId) && (() => {
                    const fi = selectedItem as FrameItem;
                    const isPrivate = !!fi.private;
                    return (
                      <>
                        <button
                          onClick={() => {
                            const next = isPrivate
                              ? { ...fi, private: false, ownerStudentId: undefined }
                              : { ...fi, private: true, ownerStudentId: currentStudentId ?? fi.ownerStudentId };
                            updateBoardItem(next);
                          }}
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border font-medium transition-all"
                          style={{
                            borderColor: isPrivate ? "#c07020" : "var(--brown-pale)",
                            background:  isPrivate ? "#fff8e0" : "transparent",
                            color:       isPrivate ? "#c07020" : "var(--brown-mid)",
                          }}
                          title={isPrivate ? "Фрейм приватный — нажмите, чтобы сделать общим" : "Сделать приватным — виден только владельцу"}
                        >
                          {isPrivate ? "🔒 Личный" : "🔓 Общий"}
                        </button>
                        {/* Student owner picker — tutor only, when frame is private and students list provided */}
                        {isPrivate && role === "tutor" && students.length > 0 && (
                          <select
                            value={fi.ownerStudentId ?? ""}
                            onChange={e => updateBoardItem({ ...fi, ownerStudentId: e.target.value || undefined })}
                            onMouseDown={e => e.stopPropagation()}
                            className="text-xs px-2 py-0.5 rounded-lg border outline-none"
                            style={{ borderColor: "#c07020", background: "#fff8e0", color: "#c07020", maxWidth: 120 }}
                            title="Чей фрейм — этот ученик видит его, остальные нет"
                          >
                            <option value="">— чей фрейм —</option>
                            {students.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
              {/* Lock indicator */}
              {locked && (
                <div className="absolute pointer-events-none flex items-center gap-1 text-xs font-medium"
                  style={{ bottom:-22, left:0, color:"#e09020", whiteSpace:"nowrap", fontSize:10 }}>
                  <Lock size={10}/> Закреплено
                </div>
              )}
            </div>
          );
        })()}

        {/* Text input — Miro-style: floating toolbar at top, textarea inline on board */}
        {textInput && textScr && (() => {
          const bgCss = textBgOpacity > 0
            ? textBgColor + Math.round(textBgOpacity * 2.55).toString(16).padStart(2,"0")
            : "transparent";
          const Sep2 = () => <div className="w-px h-5 mx-1 shrink-0" style={{ background:"#e0d8d0" }}/>;
          const TOOLBAR_H = 44;
          const TOOLBAR_W = 480;
          const containerH = containerRef.current?.clientHeight ?? 600;
          const containerW = containerRef.current?.clientWidth ?? 800;
          // Position toolbar just above the text, clamped inside canvas
          const toolbarTop = Math.max(4, Math.min(textScr.y - TOOLBAR_H - 8, containerH - TOOLBAR_H - 4));
          const toolbarLeft = Math.max(4, Math.min(textScr.x - TOOLBAR_W / 2, containerW - TOOLBAR_W - 4));
          return (
            <>
              {/* ── Floating toolbar above text (desktop only — touch devices use bottom sheet) ── */}
              {!isMobile && <div className="absolute pointer-events-auto hidden sm:flex items-center gap-0.5 px-2 py-1 rounded-2xl shadow-2xl border"
                style={{ top: toolbarTop, left: toolbarLeft, width: TOOLBAR_W,
                  background:"white", borderColor:"var(--brown-pale)", zIndex:60 }}
                onMouseDown={e => e.preventDefault()}>
                {/* Font */}
                <select value={fontIdx} onChange={e=>setFontIdx(+e.target.value)} onMouseDown={e=>e.stopPropagation()}
                  className="border-0 rounded outline-none"
                  style={{ color:"var(--brown-dark)", height:28, maxWidth:76, fontSize:11 }}>
                  {FONTS.map((f,i)=><option key={i} value={i}>{f.label}</option>)}
                </select>
                <Sep2/>
                {/* Size — editable input */}
                <input type="number" value={fontSize} min={8} max={200}
                  onChange={e=>setFontSize(Math.max(8,Math.min(200,+e.target.value)))}
                  onMouseDown={e=>e.stopPropagation()}
                  className="border rounded text-center outline-none"
                  style={{ color:"var(--brown-dark)", width:40, height:28, fontSize:12, borderColor:"var(--brown-pale)" }}/>
                <Sep2/>
                {/* Bold / Italic / Underline-placeholder */}
                <button onMouseDown={e=>e.preventDefault()} onClick={()=>setBold(b=>!b)}
                  className="w-8 h-8 rounded-lg text-sm font-bold border-2 flex items-center justify-center transition-all"
                  style={{ borderColor:bold?"#4a80f0":"transparent", color:"var(--brown-dark)", background:bold?"#eef2ff":"transparent" }}>B</button>
                <button onMouseDown={e=>e.preventDefault()} onClick={()=>setItalic(i=>!i)}
                  className="w-8 h-8 rounded-lg text-sm italic border-2 flex items-center justify-center transition-all"
                  style={{ fontFamily:"Georgia,serif", borderColor:italic?"#4a80f0":"transparent", color:"var(--brown-dark)", background:italic?"#eef2ff":"transparent" }}>I</button>
                <Sep2/>
                {/* Alignment */}
                {(["left","center","right"] as TextAlign[]).map(a=>(
                  <button key={a} onMouseDown={e=>e.preventDefault()} onClick={()=>setAlign(a)}
                    className="w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all"
                    style={{ borderColor:align===a?"#4a80f0":"transparent", background:align===a?"#eef2ff":"transparent" }}>
                    <svg width={14} height={11} viewBox="0 0 14 11" style={{ color:"var(--brown-dark)" }}>
                      {a==="left"   && <><line x1={0} y1={1.5} x2={14} y2={1.5} stroke="currentColor" strokeWidth={1.5}/><line x1={0} y1={5.5} x2={9} y2={5.5} stroke="currentColor" strokeWidth={1.5}/><line x1={0} y1={9.5} x2={11} y2={9.5} stroke="currentColor" strokeWidth={1.5}/></>}
                      {a==="center" && <><line x1={0} y1={1.5} x2={14} y2={1.5} stroke="currentColor" strokeWidth={1.5}/><line x1={2.5} y1={5.5} x2={11.5} y2={5.5} stroke="currentColor" strokeWidth={1.5}/><line x1={1.5} y1={9.5} x2={12.5} y2={9.5} stroke="currentColor" strokeWidth={1.5}/></>}
                      {a==="right"  && <><line x1={0} y1={1.5} x2={14} y2={1.5} stroke="currentColor" strokeWidth={1.5}/><line x1={5} y1={5.5} x2={14} y2={5.5} stroke="currentColor" strokeWidth={1.5}/><line x1={3} y1={9.5} x2={14} y2={9.5} stroke="currentColor" strokeWidth={1.5}/></>}
                    </svg>
                  </button>
                ))}
                <Sep2/>
                {/* Text color */}
                <label className="relative flex flex-col items-center gap-0.5 cursor-pointer w-8 h-8 rounded-lg hover:bg-gray-50 justify-center" title="Цвет текста">
                  <span className="font-bold leading-none" style={{ color:"var(--brown-dark)", fontSize:14 }}>A</span>
                  <div className="w-5 h-1 rounded-full" style={{ background:color }}/>
                  <input type="color" value={color} onChange={e=>setColor(e.target.value)}
                    className="absolute opacity-0 inset-0 cursor-pointer" onMouseDown={e=>e.stopPropagation()}/>
                </label>
                {/* Bg color */}
                <label className="relative flex flex-col items-center gap-0.5 cursor-pointer w-8 h-8 rounded-lg hover:bg-gray-50 justify-center" title="Фон">
                  <div className="w-5 h-5 rounded border-2" style={{ background:textBgOpacity>0?textBgColor:"transparent", borderColor:"var(--brown-pale)" }}/>
                  <input type="color" value={textBgColor}
                    onChange={e=>{setTextBgColor(e.target.value);if(textBgOpacity===0)setTextBgOpacity(90);}}
                    className="absolute opacity-0 inset-0 cursor-pointer" onMouseDown={e=>e.stopPropagation()}/>
                </label>
                {textBgOpacity > 0 && (
                  <button onMouseDown={e=>e.preventDefault()} onClick={()=>setTextBgOpacity(0)}
                    className="w-5 h-5 rounded text-xs leading-none flex items-center justify-center"
                    style={{ color:"var(--brown-light)" }}>×</button>
                )}
                <div className="flex-1"/>
                <Sep2/>
                <button onMouseDown={e=>e.preventDefault()} onClick={commitText}
                  className="px-3 h-8 rounded-xl text-xs font-semibold text-white shrink-0"
                  style={{ background:"var(--gradient-primary)" }}>Готово</button>
              </div>}
              {/* ── Inline textarea — Miro-style: desktop only ── */}
              {!isMobile && (() => {
                const handleStyle: React.CSSProperties = {
                  position:"absolute", width:10, height:10, borderRadius:"50%",
                  background:"white", border:"2px solid #4a80f0", pointerEvents:"none",
                };
                return (
                  <div className="absolute" style={{ left:textScr.x, top:textScr.y, zIndex:50 }}
                    onMouseDown={e => e.stopPropagation()}>
                    <textarea ref={textRef} value={textValue}
                      onChange={e => {
                        const val = e.target.value;
                        setTextValue(val);
                        // measure width via hidden span for accuracy
                        const el = e.target;
                        const lines = val.split("\n");
                        const span = document.createElement("span");
                        span.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font:${
                          el.style.fontStyle} ${el.style.fontWeight} ${el.style.fontSize} ${el.style.fontFamily
                        };padding:${el.style.padding}`;
                        document.body.appendChild(span);
                        const maxW = Math.max(...lines.map(l => { span.textContent = l||"M"; return span.getBoundingClientRect().width; }));
                        document.body.removeChild(span);
                        el.style.width = Math.max(maxW + 24, Math.round(60 * zoom)) + "px";
                        el.style.height = "auto";
                        el.style.height = el.scrollHeight + "px";
                      }}
                      onKeyDown={e => {
                        if (e.key === "Escape") { e.preventDefault(); setTextInput(null); editingIdRef.current=null; setEditingId(null); render(); }
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); commitText(); }
                      }}
                      rows={1} placeholder="Текст..."
                      style={{ display:"block", fontSize:fontSize*zoom+"px", fontFamily:FONTS[fontIdx].family,
                        fontWeight:bold?"bold":"normal", fontStyle:italic?"italic":"normal", textAlign:align,
                        color, caretColor:color,
                        backgroundColor: bgCss === "transparent" ? "transparent" : bgCss,
                        border: "1.5px solid #4a80f0",
                        borderRadius: 3,
                        outline: "none",
                        padding: `${3*zoom}px ${6*zoom}px`,
                        minWidth: Math.max(40, 60*zoom)+"px",
                        lineHeight: 1.5, resize: "none", overflow: "hidden",
                        whiteSpace: "pre",
                        WebkitAppearance: "none",
                      } as React.CSSProperties} />
                    {/* Corner handles — like Miro selection */}
                    <div style={{ ...handleStyle, top:-5, left:-5 }}/>
                    <div style={{ ...handleStyle, top:-5, right:-5 }}/>
                    <div style={{ ...handleStyle, bottom:-5, left:-5 }}/>
                    <div style={{ ...handleStyle, bottom:-5, right:-5 }}/>
                  </div>
                );
              })()}

              {/* ── Mobile bottom sheet — fixed, keyboard-aware, escapes overflow-hidden ── */}
              {isMobile && (() => {
                const cancel = () => { setTextInput(null); editingIdRef.current=null; setEditingId(null); render(); };
                return (
                  <div style={{ position:"fixed", inset:0, zIndex:300, touchAction:"auto" }} onClick={cancel}
                    onTouchStart={e=>e.stopPropagation()} onTouchMove={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
                    <div style={{
                      position:"absolute", bottom:kbOffset, left:0, right:0,
                      background:"white", borderRadius:"20px 20px 0 0",
                      borderTop:"2px solid #e8ddd2",
                      boxShadow:"0 -4px 24px rgba(0,0,0,0.15)",
                      transition:"bottom 0.15s ease",
                    }} onClick={e => e.stopPropagation()}>
                      {/* Controls */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 12px", borderBottom:"1px solid #e8ddd2", overflowX:"auto", touchAction:"pan-x" }}>
                        <button onMouseDown={e=>e.preventDefault()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();setFontSize(s=>Math.max(8,s-2));}} onClick={()=>setFontSize(s=>Math.max(8,s-2))}
                          style={{ minWidth:36, height:36, borderRadius:8, border:"1.5px solid #e8ddd2", fontSize:13, fontWeight:"bold", color:"#3A2117", background:"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>A−</button>
                        <span style={{ fontSize:13, color:"#3A2117", width:30, textAlign:"center", flexShrink:0 }}>{fontSize}</span>
                        <button onMouseDown={e=>e.preventDefault()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();setFontSize(s=>Math.min(200,s+2));}} onClick={()=>setFontSize(s=>Math.min(200,s+2))}
                          style={{ minWidth:36, height:36, borderRadius:8, border:"1.5px solid #e8ddd2", fontSize:13, fontWeight:"bold", color:"#3A2117", background:"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>A+</button>
                        <div style={{ width:1, height:24, background:"#e8ddd2", flexShrink:0 }}/>
                        <button onMouseDown={e=>e.preventDefault()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();setBold(b=>!b);}} onClick={()=>setBold(b=>!b)}
                          style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${bold?"#4a80f0":"#e8ddd2"}`, fontWeight:"bold", fontSize:15, color:"#3A2117", background:bold?"#eef2ff":"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>B</button>
                        <button onMouseDown={e=>e.preventDefault()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();setItalic(i=>!i);}} onClick={()=>setItalic(i=>!i)}
                          style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${italic?"#4a80f0":"#e8ddd2"}`, fontStyle:"italic", fontFamily:"Georgia,serif", fontSize:15, color:"#3A2117", background:italic?"#eef2ff":"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>I</button>
                        <label style={{ position:"relative", width:36, height:36, borderRadius:8, border:"1.5px solid #e8ddd2", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, gap:2 }}>
                          <span style={{ fontWeight:"bold", fontSize:14, color, lineHeight:"1" }}>A</span>
                          <div style={{ width:20, height:3, borderRadius:2, background:color }}/>
                          <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ position:"absolute", opacity:0, inset:0, cursor:"pointer" }}/>
                        </label>
                        <div style={{ flex:1 }}/>
                        <button onMouseDown={e=>e.preventDefault()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();cancel();}} onClick={cancel}
                          style={{ height:36, padding:"0 12px", borderRadius:10, border:"1.5px solid #e8ddd2", fontSize:13, color:"#3A2117", background:"white", flexShrink:0 }}>Отмена</button>
                        <button onMouseDown={e=>e.preventDefault()} onTouchEnd={e=>{e.preventDefault();e.stopPropagation();commitText();}} onClick={commitText}
                          style={{ height:36, padding:"0 14px", borderRadius:10, fontSize:13, fontWeight:600, color:"white", background:"linear-gradient(135deg,#74070E,#a01018)", border:"none", flexShrink:0 }}>Готово</button>
                      </div>
                      {/* Textarea — keyboard pushes this up naturally on mobile */}
                      <div style={{ padding:"10px 14px 24px" }}>
                        <textarea
                          ref={textRef}
                          value={textValue}
                          onChange={e => {
                            setTextValue(e.target.value);
                            const ta = e.target;
                            ta.style.height = "auto";
                            ta.style.height = ta.scrollHeight + "px";
                          }}
                          placeholder="Введите текст..."
                          autoFocus
                          rows={2}
                          style={{
                            width:"100%", boxSizing:"border-box",
                            fontSize: Math.max(16, Math.min(fontSize, 28))+"px",
                            fontFamily: FONTS[fontIdx].family,
                            fontWeight: bold?"bold":"normal",
                            fontStyle: italic?"italic":"normal",
                            color,
                            border:"1.5px solid #e8ddd2", borderRadius:12,
                            padding:"10px 12px", resize:"none", outline:"none", lineHeight:1.5,
                            overflow:"hidden",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </>
          );
        })()}

        {/* Image crop overlay */}
        {cropId && (() => {
          const ci = itemsRef.current.find(i => i.id === cropId) as ImageItem | undefined;
          if (!ci) { setCropId(null); return null; }
          const sp = w2s(ci.x, ci.y);
          const ep = w2s(ci.x + ci.w, ci.y + ci.h);
          const sw = ep.x - sp.x, sh = ep.y - sp.y;
          // cropRef stores current crop box in 0-1 normalized coords
          if (!cropRef.current) cropRef.current = { ox:ci.x, oy:ci.y, ow:ci.w, oh:ci.h, sx:0, sy:0, ex:1, ey:1 };
          const cr = cropRef.current;
          const csx = sp.x + cr.sx * sw, csy = sp.y + cr.sy * sh;
          const cex = sp.x + cr.ex * sw, cey = sp.y + cr.ey * sh;
          const commitCrop = () => {
            const idx = itemsRef.current.findIndex(i => i.id === cropId);
            if (idx < 0) { setCropId(null); cropRef.current=null; return; }
            const c = cropRef.current!;
            const next: ImageItem = { ...ci, x: ci.x + c.sx*ci.w, y: ci.y + c.sy*ci.h,
              w: (c.ex-c.sx)*ci.w, h: (c.ey-c.sy)*ci.h };
            itemsRef.current[idx] = next; pushHistory({type:"update",idx,prev:ci,next}); send({type:"update",item:next});
            render(); setCropId(null); cropRef.current=null;
          };
          return (
            <div className="absolute inset-0 pointer-events-none" style={{ zIndex:55 }}>
              {/* Darken outside crop */}
              <div className="absolute inset-0" style={{ background:"rgba(0,0,0,0.5)" }}>
                <div className="absolute" style={{ left:csx, top:csy, width:cex-csx, height:cey-csy, background:"transparent", boxShadow:"0 0 0 9999px rgba(0,0,0,0.45)" }}/>
              </div>
              {/* Crop box border */}
              <div className="absolute pointer-events-auto" style={{ left:csx, top:csy, width:cex-csx, height:cey-csy,
                border:"2px solid white", boxSizing:"border-box" }}>
                {/* Corner handles */}
                {([["nw",0,0],["ne",1,0],["sw",0,1],["se",1,1]] as [string,number,number][]).map(([c,hx,hy])=>(
                  <div key={c} className="absolute pointer-events-auto"
                    style={{ left:hx===0?-6:"auto", right:hx===1?-6:"auto",
                      top:hy===0?-6:"auto", bottom:hy===1?-6:"auto",
                      width:12, height:12, background:"white", borderRadius:2, cursor:`${c}-resize` }}
                    onMouseDown={e => {
                      e.stopPropagation(); e.preventDefault();
                      const startX=e.clientX, startY=e.clientY;
                      const orig={...cropRef.current!};
                      const onMove=(me:MouseEvent)=>{
                        const dx=(me.clientX-startX)/sw, dy=(me.clientY-startY)/sh;
                        const c2=cropRef.current!;
                        if(hx===0) c2.sx=Math.max(0,Math.min(orig.sx+dx,c2.ex-0.05));
                        if(hx===1) c2.ex=Math.min(1,Math.max(orig.ex+dx,c2.sx+0.05));
                        if(hy===0) c2.sy=Math.max(0,Math.min(orig.sy+dy,c2.ey-0.05));
                        if(hy===1) c2.ey=Math.min(1,Math.max(orig.ey+dy,c2.sy+0.05));
                        setPanVer(v=>v+1);
                      };
                      const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);cropDragRef.current=null;};
                      cropDragRef.current={move:onMove,up:onUp};
                      window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
                    }}
                    onTouchStart={e => {
                      e.stopPropagation(); e.preventDefault();
                      const t0=e.touches[0];
                      const startX=t0.clientX, startY=t0.clientY;
                      const orig={...cropRef.current!};
                      const onMove=(te:TouchEvent)=>{
                        const t=te.touches[0];
                        const dx=(t.clientX-startX)/sw, dy=(t.clientY-startY)/sh;
                        const c2=cropRef.current!;
                        if(hx===0) c2.sx=Math.max(0,Math.min(orig.sx+dx,c2.ex-0.05));
                        if(hx===1) c2.ex=Math.min(1,Math.max(orig.ex+dx,c2.sx+0.05));
                        if(hy===0) c2.sy=Math.max(0,Math.min(orig.sy+dy,c2.ey-0.05));
                        if(hy===1) c2.ey=Math.min(1,Math.max(orig.ey+dy,c2.sy+0.05));
                        setPanVer(v=>v+1);
                      };
                      const onUp=()=>{window.removeEventListener("touchmove",onMove);window.removeEventListener("touchend",onUp);cropDragRef.current=null;};
                      cropDragRef.current={move:onMove as unknown as (e:MouseEvent)=>void, up:onUp};
                      window.addEventListener("touchmove",onMove,{passive:false}); window.addEventListener("touchend",onUp);
                    }}/>
                ))}
              </div>
              {/* Confirm / Cancel */}
              <div className="absolute flex gap-2 pointer-events-auto"
                style={{ top: csy - 38, left: csx }}>
                <button onClick={commitCrop}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-white shadow-lg"
                  style={{ background:"#4a8a4a" }}>✓ Применить</button>
                <button onClick={() => { setCropId(null); cropRef.current=null; }}
                  className="px-3 py-1 rounded-lg text-xs font-medium text-white shadow-lg"
                  style={{ background:"#888" }}>Отмена</button>
              </div>
            </div>
          );
        })()}

        {pdfLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none"
            style={{ background:"rgba(255,255,255,0.45)" }}>
            <div className="text-sm font-medium px-4 py-2 rounded-xl"
              style={{ background:"white", color:"var(--brown-dark)", boxShadow:"var(--shadow-card)" }}>
              Загрузка страницы...
            </div>
          </div>
        )}

        {/* Wheel edit dialog */}
        {editWheelId && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" data-no-prevent style={{ background:"rgba(0,0,0,0.4)" }}
            onClick={e => { if (e.target === e.currentTarget) setEditWheelId(null); }}
            onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
            <div className="w-full max-w-sm rounded-2xl border shadow-2xl p-5"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="font-semibold mb-3 text-sm" style={{ color:"var(--brown-dark)" }}>🎡 Варианты колеса</div>
              <textarea value={editWheelText} onChange={e => setEditWheelText(e.target.value)}
                rows={8} placeholder="Вариант 1&#10;Вариант 2&#10;Вариант 3&#10;..."
                className="w-full px-3 py-2 rounded-xl border outline-none text-sm resize-none mb-3"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}/>
              <div className="flex gap-2">
                <button onClick={saveWheelEdit}
                  className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background:"var(--gradient-primary)" }}>Сохранить</button>
                <button onClick={() => setEditWheelId(null)}
                  className="px-4 py-2 rounded-xl border text-sm"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-light)" }}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {/* Emoji picker panel — fixed, right of sidebar */}
        {showEmojiPicker && (
          <div className="absolute inset-y-0 left-0 z-[100] flex"
            onClick={e => { if (e.target === e.currentTarget) setShowEmojiPicker(false); }}
            onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
            <div className="flex flex-col shadow-2xl border-r h-full"
              style={{ width:320, background:"white", borderColor:"var(--brown-pale)" }}>
              {/* Header */}
              <div className="flex items-center gap-2 px-3 pt-3 pb-2 border-b shrink-0" style={{ borderColor:"var(--brown-pale)" }}>
                <div className="flex-1 relative">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm" style={{ color:"var(--brown-light)" }}>🔍</span>
                  <input value={emojiSearch} onChange={e=>setEmojiSearch(e.target.value)}
                    placeholder="Поиск эмодзи..." autoFocus
                    className="w-full pl-7 pr-3 py-1.5 rounded-xl border text-sm outline-none"
                    style={{ borderColor:"#4a80f0", color:"var(--brown-dark)" }}/>
                </div>
                <button onClick={()=>setShowEmojiPicker(false)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center hover:opacity-60 border"
                  style={{ color:"var(--brown-light)", borderColor:"var(--brown-pale)" }}>✕</button>
              </div>
              {/* Scrollable list */}
              <div className="flex-1 overflow-y-auto p-2 min-h-0" data-no-canvas-wheel>
                {EMOJI_CATEGORIES.map(cat => {
                  const q = emojiSearch.toLowerCase().trim();
                  const emojis = q
                    ? cat.emojis.filter(em =>
                        (EMOJI_TAGS[em] ?? "").includes(q) ||
                        cat.label.toLowerCase().includes(q)
                      )
                    : cat.emojis;
                  if (!emojis.length) return null;
                  const addEmoji = (emoji: string) => {
                    setPendingSymbol(emoji);
                    setShowEmojiPicker(false);
                  };
                  return (
                    <div key={cat.label} className="mb-3">
                      <div className="text-xs font-semibold px-1 mb-1.5 sticky top-0 py-1"
                        style={{ color:"var(--brown-mid)", background:"white" }}>{cat.label}</div>
                      <div className="grid grid-cols-8 gap-0.5">
                        {emojis.map((em, i) => (
                          <button key={i} onClick={()=>addEmoji(em)}
                            className="w-9 h-9 rounded-lg text-2xl flex items-center justify-center hover:bg-amber-50 active:scale-90 transition-all">
                            {em}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Click outside to close */}
            <div className="flex-1" onClick={()=>setShowEmojiPicker(false)}/>
          </div>
        )}

        {/* Image dialog */}
        {imgDialog && (
          <div className="absolute inset-0 flex items-center justify-center z-50"
            style={{ background:"rgba(0,0,0,0.35)" }}
            data-no-prevent
            onClick={() => setImgDialog(false)}
            onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
            <div className="rounded-2xl border shadow-2xl p-5 w-full max-w-sm mx-4"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}
              onClick={e => e.stopPropagation()}>
              <div className="font-semibold mb-4" style={{ color:"var(--brown-dark)" }}>
                Добавить изображение
              </div>
              <div className="space-y-3">
                <div>
                  <div className="text-xs mb-1.5 font-medium" style={{ color:"var(--brown-mid)" }}>URL изображения</div>
                  <div className="flex gap-2">
                    <input value={imgUrl} onChange={e => { setImgUrl(e.target.value); setImgError(null); }}
                      onKeyDown={e => e.key==="Enter" && addImageToBoard(imgUrl)}
                      placeholder="https://..."
                      autoFocus={!isMobile}
                      className="flex-1 px-3 py-2 rounded-xl border outline-none text-sm"
                      style={{ borderColor: imgError ? "#e05050" : "var(--brown-pale)", color:"var(--brown-dark)" }}/>
                    <button onClick={() => addImageToBoard(imgUrl)}
                      disabled={!imgUrl.trim()}
                      className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                      style={{ background:"var(--gradient-primary)" }}>
                      <Link size={14}/>
                    </button>
                  </div>
                  {imgError && <div className="text-xs mt-1" style={{ color:"#e05050" }}>{imgError}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px" style={{ background:"var(--brown-pale)" }}/>
                  <span className="text-xs" style={{ color:"var(--brown-light)" }}>или</span>
                  <div className="flex-1 h-px" style={{ background:"var(--brown-pale)" }}/>
                </div>
                <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed cursor-pointer hover:opacity-80 transition-all"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-mid)" }}>
                  {imgUploading ? "Загрузка..." : <><ImagePlus size={16}/> Загрузить файл</>}
                  <input type="file" accept="image/*" className="hidden" disabled={imgUploading}
                    onChange={e => { const f = e.target.files?.[0]; if(f) uploadAndAddImage(f); }}/>
                </label>
              </div>
              <button onClick={() => setImgDialog(false)}
                className="mt-4 w-full py-2 rounded-xl border text-sm"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-light)" }}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Table size picker */}
        {showTablePicker && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" data-no-prevent style={{ background:"rgba(0,0,0,0.4)" }}
            onClick={e => { if (e.target === e.currentTarget) setShowTablePicker(false); }}
            onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}>
            <div className="rounded-2xl border shadow-2xl p-5 w-72" style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="font-semibold mb-4 text-sm" style={{ color:"var(--brown-dark)" }}>⊞ Создать таблицу</div>
              <div className="flex items-center gap-3 mb-3">
                <label className="text-xs" style={{ color:"var(--brown-mid)" }}>Строк:</label>
                <input type="number" min={1} max={20} value={tableRows} onChange={e=>setTableRows(+e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg border outline-none text-sm text-center"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}/>
                <label className="text-xs" style={{ color:"var(--brown-mid)" }}>Столбцов:</label>
                <input type="number" min={1} max={20} value={tableCols} onChange={e=>setTableCols(+e.target.value)}
                  className="w-16 px-2 py-1 rounded-lg border outline-none text-sm text-center"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}/>
              </div>
              <div className="border rounded-lg overflow-hidden mb-4" style={{ borderColor:"var(--brown-pale)" }}>
                {Array.from({length:Math.min(tableRows,6)}).map((_,r)=>(
                  <div key={r} className="flex">
                    {Array.from({length:Math.min(tableCols,6)}).map((_,c)=>(
                      <div key={c} className="flex-1 h-6 border-r border-b last:border-r-0"
                        style={{ borderColor:"var(--brown-pale)", background: r===0?"var(--brown-pale)":"white" }}/>
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => { addTableToBoard(tableRows, tableCols); setShowTablePicker(false); }}
                  className="flex-1 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background:"var(--gradient-primary)" }}>
                  Добавить
                </button>
                <button onClick={() => setShowTablePicker(false)}
                  className="px-4 py-2 rounded-xl border text-sm"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-light)" }}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {/* Symbol picker */}
        {showSymbols && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center pt-16 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.2)" }}
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowSymbols(false); }}>
            <div className="rounded-2xl border shadow-xl overflow-hidden"
              style={{ background:"white", borderColor:"var(--brown-pale)", width:340 }}>
              <div className="flex border-b overflow-x-auto" style={{ borderColor:"var(--brown-pale)" }}>
                {Object.keys(SYMBOLS).map(tab => (
                  <button key={tab} onClick={() => setSymTab(tab)}
                    className="text-xs px-3 py-2 shrink-0 whitespace-nowrap"
                    style={{ color: symTab===tab?"var(--brown-dark)":"var(--brown-light)",
                             fontWeight: symTab===tab?600:400,
                             borderBottom: symTab===tab?"2px solid var(--brown-dark)":"2px solid transparent" }}>
                    {tab}
                  </button>
                ))}
              </div>
              <div className="p-2 grid grid-cols-8 gap-1 max-h-48 overflow-y-auto">
                {SYMBOLS[symTab].map(sym => (
                  <button key={sym} onClick={() => { insertSymbol(sym); setShowSymbols(false); }}
                    className="w-8 h-8 rounded-lg border hover:opacity-70 text-base flex items-center justify-center"
                    style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Video upload progress */}
        {(videoUploadProgress !== null || videoUploadError) && (
          <div className="fixed bottom-20 left-1/2 z-[9000] -translate-x-1/2 rounded-xl shadow-lg px-4 py-3 flex items-center gap-3 text-sm"
            data-no-prevent style={{ background: videoUploadError ? "#fee2e2" : "white", border: `1px solid ${videoUploadError ? "#fca5a5" : "var(--brown-pale)"}`, minWidth: 220 }}>
            {videoUploadError ? (
              <>
                <span style={{ color: "#dc2626" }}>✕ {videoUploadError}</span>
                <button onClick={() => setVideoUploadError(null)} style={{ color: "#dc2626", marginLeft: "auto" }}>✕</button>
              </>
            ) : (
              <>
                <span style={{ color: "var(--brown-dark)" }}>Загрузка видео...</span>
                <div className="flex-1 rounded-full overflow-hidden h-1.5" style={{ background: "var(--brown-pale)", minWidth: 80 }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${videoUploadProgress}%`, background: "var(--gradient-primary)" }}/>
                </div>
                <span className="font-bold tabular-nums" style={{ color: "var(--brown-dark)" }}>{videoUploadProgress}%</span>
              </>
            )}
          </div>
        )}

        {/* Flip overlay */}
        {flipOverlay && (() => {
          const fo = flipOverlay;
          return (
            <FlipCard key={fo.instanceId}
              sx={fo.sx} sy={fo.sy} sw={fo.sw} sh={fo.sh} rotation={fo.rotation}
              word={fo.word} translation={fo.translation} fromHidden={fo.fromHidden}
            />
          );
        })()}

        {/* Vocab cards panel */}
        {showVocabPanel && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center pt-16 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.25)" }}
            onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowVocabPanel(false); }}>
            <div className="rounded-2xl shadow-xl p-5 w-full max-w-sm"
              style={{ background:"white", borderColor:"var(--brown-pale)", border:"1px solid" }}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-semibold text-base" style={{ color:"var(--brown-dark)" }}>Флеш-карточки</span>
                <button onClick={()=>setShowVocabPanel(false)} style={{ color:"var(--brown-mid)" }}><X size={18}/></button>
              </div>
              {vocabLoading ? (
                <div className="text-center py-6 text-sm" style={{ color:"var(--brown-mid)" }}>Загрузка...</div>
              ) : vocabTopics.length === 0 ? (
                <div className="text-center py-6 text-sm" style={{ color:"var(--brown-mid)" }}>У ученика нет тем словаря</div>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="text-xs font-medium block mb-1" style={{ color:"var(--brown-mid)" }}>Тема</label>
                    <select value={vocabTopicId} onChange={e=>{ setVocabTopicId(e.target.value); setVocabSelWords(new Set()); }}
                      className="w-full border rounded-lg px-3 py-2 text-sm"
                      style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                      {vocabTopics.map(t=><option key={t.id} value={t.id}>{t.title}</option>)}
                    </select>
                  </div>
                  <div className="mb-3 flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color:"var(--brown-dark)" }}>
                      <input type="checkbox" checked={vocabFaceDown} onChange={e=>setVocabFaceDown(e.target.checked)}
                        className="accent-[var(--brown-dark)]"/>
                      Рубашкой вниз
                    </label>
                  </div>
                  {(() => {
                    const topic = vocabTopics.find(t=>t.id===vocabTopicId);
                    if (!topic) return null;
                    return (
                      <>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-xs font-medium" style={{ color:"var(--brown-mid)" }}>Слова ({topic.words.length})</span>
                          <button className="text-xs underline" style={{ color:"var(--brown-mid)" }}
                            onClick={()=>setVocabSelWords(vocabSelWords.size===topic.words.length ? new Set() : new Set(topic.words.map(w=>w.id)))}>
                            {vocabSelWords.size===topic.words.length ? "Снять все" : "Выбрать все"}
                          </button>
                        </div>
                        <div className="overflow-y-auto max-h-48 flex flex-col gap-1 mb-4 pr-1">
                          {topic.words.map(w=>(
                            <label key={w.id} className="flex items-center gap-2 text-sm cursor-pointer px-2 py-1 rounded-lg hover:bg-[var(--brown-pale)]">
                              <input type="checkbox" checked={vocabSelWords.has(w.id)}
                                onChange={e=>{ const s=new Set(vocabSelWords); e.target.checked?s.add(w.id):s.delete(w.id); setVocabSelWords(s); }}
                                className="accent-[var(--brown-dark)]"/>
                              <span style={{ color:"var(--brown-dark)" }}>{w.word}</span>
                              <span className="ml-auto" style={{ color:"var(--brown-mid)" }}>{w.translation}</span>
                            </label>
                          ))}
                        </div>
                        <button onClick={addCardsToBoard}
                          disabled={vocabSelWords.size===0}
                          className="w-full py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
                          style={{ background:"var(--gradient-primary)", color:"white" }}>
                          Добавить на доску ({vocabSelWords.size})
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          </div>
        )}

        {/* Dice panel */}
        {showDice && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center pt-16 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.2)" }}
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowDice(false); }}>
            <div className="rounded-2xl border shadow-xl p-4 w-56"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-medium" style={{ color:"var(--brown-dark)" }}>Кубиков:</span>
                {[1,2,3,4,5,6].map(n => (
                  <button key={n} onClick={() => setDiceCount(n)}
                    className="w-7 h-7 rounded-lg border-2 text-xs font-bold transition-all"
                    style={{ borderColor: diceCount===n?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity: diceCount===n?1:0.5 }}>
                    {n}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mb-3">
                <button onClick={rollDice} disabled={diceRolling}
                  className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background:"var(--gradient-primary)" }}>
                  {diceRolling ? "Бросаю..." : "Бросить!"}
                </button>
                {role === "tutor" && (
                  <button onClick={() => { addDiceToBoard(diceCount); setShowDice(false); }}
                    className="px-3 py-2 rounded-xl text-xs border-2 font-medium"
                    style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}
                    title="Добавить кубик на доску">
                    + Доска
                  </button>
                )}
              </div>
              {diceResult.length > 0 && (
                <div className="flex gap-2 justify-center flex-wrap">
                  {diceResult.map((v, i) => (
                    <DiceFaceSvg key={i} value={v} size={48} rolling={diceRolling}/>
                  ))}
                  {diceCount > 1 && (
                    <div className="w-full text-center text-sm font-bold mt-1" style={{ color:"var(--brown-dark)" }}>
                      Сумма: {diceResult.reduce((a,b)=>a+b,0)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* f(x) panel — mobile sheet (desktop uses the absolute dropdown in context bar) */}
        {showFnPanel && (
          <div className="sm:hidden fixed inset-0 z-[250] flex items-end justify-center pb-4 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.2)" }}
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowFnPanel(false); }}>
            <div className="w-full max-w-sm rounded-2xl border shadow-xl p-4"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="text-sm font-semibold mb-1" style={{ color:"var(--brown-dark)" }}>График функции</div>
              <div className="text-xs mb-3" style={{ color:"var(--brown-mid)" }}>График вставляется как объект на доску</div>
              <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); addFunction(); setShowFnPanel(false); }}>
                <span className="text-sm font-mono shrink-0" style={{ color:"var(--brown-mid)" }}>y =</span>
                <input value={fnFormula} onChange={e => { setFnFormula(e.target.value); setFnError(false); }}
                  placeholder="x², sin(x), 2x+1…" autoComplete="off" spellCheck={false} autoFocus
                  className="text-sm font-mono px-3 py-2 rounded-xl border outline-none flex-1"
                  style={{ borderColor: fnError ? "#e05050" : "var(--brown-pale)", background:"#fdf8f0", color:"var(--brown-dark)" }}/>
                <button type="submit" disabled={!fnFormula.trim()}
                  className="text-sm px-4 py-2 rounded-xl font-medium shrink-0 disabled:opacity-40"
                  style={{ background:"var(--gradient-primary)", color:"white" }}>
                  OK
                </button>
              </form>
              {fnError && <div className="text-xs mt-2" style={{ color:"#e05050" }}>Неверная формула. Примеры: x^2, sin(x), 2*x+1</div>}
            </div>
          </div>
        )}

        {/* Formula panel (mobile) */}
        {showFormulaPanel && (
          <div className="sm:hidden fixed inset-0 z-[250] flex items-end justify-center pb-4 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.2)" }}
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowFormulaPanel(false); }}>
            <div className="w-full max-w-sm rounded-2xl border shadow-xl p-4"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="text-sm font-semibold mb-1" style={{ color:"var(--brown-dark)" }}>Формула LaTeX</div>
              <div className="text-xs mb-3" style={{ color:"var(--brown-mid)" }}>Например: \frac{"{}{}"}a{"{}"}b, x^2, \int_0^1 x\,dx</div>
              <form className="flex items-center gap-2" onSubmit={e => { e.preventDefault(); addFormulaToBoard(); }}>
                <input value={formulaInput} onChange={e => setFormulaInput(e.target.value)}
                  placeholder="\frac{a}{b}" autoComplete="off" spellCheck={false} autoFocus
                  className="text-sm font-mono px-3 py-2 rounded-xl border outline-none flex-1"
                  style={{ borderColor:"var(--brown-pale)", background:"#fdf8f0", color:"var(--brown-dark)" }}/>
                <button type="submit" disabled={!formulaInput.trim()}
                  className="text-sm px-4 py-2 rounded-xl font-medium shrink-0 disabled:opacity-40"
                  style={{ background:"var(--gradient-primary)", color:"white" }}>OK</button>
              </form>
            </div>
          </div>
        )}

        {/* Code panel (mobile) */}
        {showCodePanel && (
          <div className="sm:hidden fixed inset-0 z-[250] flex items-end justify-center pb-4 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.2)" }}
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowCodePanel(false); }}>
            <div className="w-full max-w-sm rounded-2xl border shadow-xl p-4"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="text-sm font-semibold mb-1" style={{ color:"var(--brown-dark)" }}>Блок кода</div>
              <div className="flex gap-1.5 mb-2">
                {(["python","javascript","sql","cpp"] as const).map(l => (
                  <button key={l} onClick={() => setCodeLang(l)}
                    className="text-xs px-2 py-1 rounded-lg border"
                    style={{ borderColor: codeLang===l?"var(--brown-dark)":"var(--brown-pale)", fontWeight: codeLang===l?600:400, background: codeLang===l?"var(--brown-pale)":"transparent", color:"var(--brown-dark)" }}>
                    {l}
                  </button>
                ))}
              </div>
              <form onSubmit={e => { e.preventDefault(); addCodeToBoard(); }}>
                <textarea value={codeInput} onChange={e => setCodeInput(e.target.value)}
                  placeholder="# код здесь" rows={6} spellCheck={false} autoFocus
                  className="w-full text-xs font-mono px-3 py-2 rounded-xl border outline-none resize-none"
                  style={{ borderColor:"var(--brown-pale)", background:"#f8fffe", color:"var(--brown-dark)" }}/>
                <button type="submit" disabled={!codeInput.trim()}
                  className="mt-2 text-sm px-4 py-2 rounded-xl font-medium disabled:opacity-40"
                  style={{ background:"var(--gradient-primary)", color:"white" }}>Добавить</button>
              </form>
            </div>
          </div>
        )}

        {/* Wheel panel */}
        {showWheel && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center pt-16 px-4"
            data-no-prevent style={{ background:"rgba(0,0,0,0.2)" }}
            onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
            onClick={e=>{ if(e.target===e.currentTarget) setShowWheel(false); }}>
            <div className="rounded-2xl border shadow-xl p-4 w-72"
              style={{ background:"white", borderColor:"var(--brown-pale)" }}>
              <div className="flex justify-center mb-3">
                <canvas ref={wheelCanvasRef} width={220} height={220} className="rounded-xl"/>
              </div>
              {wheelResult && (
                <div className="text-center mb-3 px-3 py-2 rounded-xl font-bold text-sm"
                  style={{ background:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  🎉 {wheelResult}
                </div>
              )}
              <div className="flex gap-2 mb-3">
                <button onClick={spinWheel} disabled={wheelSpinning}
                  className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60"
                  style={{ background:"var(--gradient-primary)" }}>
                  {wheelSpinning ? "Крутится..." : "Крутить!"}
                </button>
                {role === "tutor" && (
                  <button onClick={() => { addWheelToBoard(); setShowWheel(false); }}
                    className="px-3 py-2 rounded-xl text-xs border-2 font-medium"
                    style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}
                    title="Добавить колесо на доску">
                    + Доска
                  </button>
                )}
              </div>
              <textarea value={wheelItems} onChange={e => { setWheelItems(e.target.value); setWheelResult(null); }}
                rows={4} placeholder="Вариант 1&#10;Вариант 2&#10;..."
                className="w-full px-3 py-2 rounded-xl border outline-none text-xs resize-none"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}/>
            </div>
          </div>
        )}

        {/* Minimap — collapsed icon / expanded panel */}
        <div className="absolute bottom-3 right-3 z-[60] flex flex-col items-end gap-1.5" data-no-prevent
          onTouchStart={e => e.stopPropagation()}
          onTouchEnd={e => e.stopPropagation()}>
          {/* Expanded panel */}
          {showMinimap && (
            <div className="rounded-xl overflow-hidden shadow-xl border"
              style={{ width:210, background:"rgba(255,255,255,0.96)", borderColor:"var(--brown-pale)" }}>
              {/* Header */}
              <div className="flex items-center justify-between px-2.5 py-1.5 border-b"
                style={{ borderColor:"var(--brown-pale)" }}>
                <span className="text-xs font-medium" style={{ color:"var(--brown-mid)" }}>Карта доски</span>
                <button onClick={fitAll} className="text-xs px-1.5 py-0.5 rounded hover:opacity-70 transition-opacity"
                  style={{ color:"var(--brown-mid)" }} title="Показать всё содержимое">
                  <Minimize2 size={11}/>
                </button>
              </div>
              {/* Canvas */}
              <canvas ref={minimapRef} width={210} height={130} style={{ display:"block", cursor:"crosshair" }}
                onClick={e => {
                  const mm = minimapMapRef.current;
                  if (!mm) return;
                  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                  const wx = (e.clientX - rect.left - mm.offX) / mm.scale + mm.minX;
                  const wy = (e.clientY - rect.top  - mm.offY) / mm.scale + mm.minY;
                  const cont = containerRef.current;
                  if (!cont) return;
                  const { zoom } = viewRef.current;
                  applyView(zoom, cont.clientWidth / 2 - wx * zoom, cont.clientHeight / 2 - wy * zoom);
                  render();
                }}
                onTouchEnd={e => {
                  const mm = minimapMapRef.current;
                  if (!mm) return;
                  const touch = e.changedTouches[0];
                  const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
                  const wx = (touch.clientX - rect.left - mm.offX) / mm.scale + mm.minX;
                  const wy = (touch.clientY - rect.top  - mm.offY) / mm.scale + mm.minY;
                  const cont = containerRef.current;
                  if (!cont) return;
                  const { zoom } = viewRef.current;
                  applyView(zoom, cont.clientWidth / 2 - wx * zoom, cont.clientHeight / 2 - wy * zoom);
                  render();
                }}/>
            </div>
          )}
          {/* Toggle button — always visible */}
          <button onClick={() => { setShowMinimap(v => !v); setTimeout(() => render(), 0); }}
            onTouchEnd={e => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLButtonElement).click(); }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md border transition-all"
            style={{
              background: showMinimap ? "var(--brown-pale)" : "rgba(255,255,255,0.92)",
              borderColor: showMinimap ? "var(--brown-dark)" : "var(--brown-pale)",
              color: "var(--brown-dark)",
            }}
            title={showMinimap ? "Скрыть карту" : "Показать карту"}>
            <MapIcon size={16}/>
          </button>
        </div>

        {/* Hidden input for AI layout upload — always mounted */}
        <input ref={aiInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if(f) { handleAiLayout(f); e.target.value = ""; } }}/>

        {/* Mobile zoom HUD — top center, always visible, tap % to reset */}
        <div className="sm:hidden absolute top-2 left-1/2 z-[55] flex items-center rounded-full pointer-events-auto select-none"
          style={{ transform:"translateX(-50%)", background:"rgba(255,255,255,0.94)", border:"1px solid var(--brown-pale)", boxShadow:"0 1px 6px rgba(0,0,0,0.13)" }}>
          <button onClick={() => zoomCenter(1/1.3)} onTouchEnd={e=>e.stopPropagation()} className="px-2 py-1.5 rounded-l-full hover:opacity-70"
            style={{ color:"var(--brown-dark)" }}><ZoomOut size={14}/></button>
          <button
            onClick={() => {
              const c = containerRef.current;
              if (!c) return;
              const { zoom, panX, panY } = viewRef.current;
              const cx = c.clientWidth / 2, cy = c.clientHeight / 2;
              applyView(1, cx - (cx - panX) / zoom, cy - (cy - panY) / zoom);
            }}
            onTouchEnd={e=>e.stopPropagation()}
            className="text-xs font-bold px-1 tabular-nums"
            title="Сбросить до 100%"
            style={{ minWidth:44, textAlign:"center", color: vpZoom !== 100 ? "#e05030" : "var(--brown-dark)" }}>
            {vpZoom}%
          </button>
          <button onClick={() => zoomCenter(1.3)} onTouchEnd={e=>e.stopPropagation()} className="px-2 py-1.5 rounded-r-full hover:opacity-70"
            style={{ color:"var(--brown-dark)" }}><ZoomIn size={14}/></button>
        </div>
      </div>

      {/* Desktop bottom bar — shown when item is selected */}
      {selectedItem && !touchDragging && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 border-t shrink-0 overflow-x-auto"
          style={{ borderColor:"var(--brown-pale)", background:"white", minHeight:44 }}
          onMouseDown={e => e.stopPropagation()}>
          {/* Duplicate */}
          <button
            onClick={() => { const d=shiftItem({...selectedItem,id:uid()},24,24); itemsRef.current.push(d); send({type:"path",item:d}); pushHistory({type:"add",item:d}); render(); }}
            className="rounded-lg px-2 py-1 text-xs font-medium border hover:opacity-80 flex items-center gap-1"
            title="Дублировать"
            style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
            ⧉ Дубль
          </button>
          {/* Crop — image only */}
          {selectedItem.type === "image" && (
            <button onClick={() => setCropId(selectedItem.id)}
              className="rounded-lg px-2 py-1 text-xs font-medium border hover:opacity-80"
              title="Обрезать"
              style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
              ✂ Обрезать
            </button>
          )}
          <div className="w-px h-5 shrink-0" style={{ background:"var(--brown-pale)" }}/>
          {/* Layer buttons */}
          <button onClick={() => reorderItem(selectedItem.id, "forward")}
            className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
            title="Вперёд" style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
            <ChevronUp size={14}/>
          </button>
          <button onClick={() => reorderItem(selectedItem.id, "backward")}
            className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
            title="Назад" style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
            <ChevronDown size={14}/>
          </button>
          <button onClick={() => reorderItem(selectedItem.id, "front")}
            className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
            title="На передний план" style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
            <ChevronsUp size={14}/>
          </button>
          <button onClick={() => reorderItem(selectedItem.id, "back")}
            className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
            title="На задний план" style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
            <ChevronsDown size={14}/>
          </button>
          {/* Text colors */}
          {selectedItem.type === "text" && !selectedItem.locked && (
            <>
              <div className="w-px h-5 shrink-0" style={{ background:"var(--brown-pale)" }}/>
              {(["#1a1a1a","#e05030","#4a80f0","#2a9d5c","#e0a020","#9b59b6","#ffffff"] as const).map(c => (
                <button key={c}
                  onClick={() => updateBoardItem({...selectedItem as TextItem, color: c})}
                  className="w-5 h-5 rounded-full shrink-0 border-2"
                  style={{ background: c, borderColor: (selectedItem as TextItem).color === c ? "#4a80f0" : "var(--brown-pale)" }}/>
              ))}
              {/* Custom text color popup trigger */}
              <button
                onClick={e => { const r=(e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setPickerPos({x:r.left,y:r.top}); setOpenPicker(p => p==="textCustom"?null:"textCustom"); }}
                className="w-5 h-5 rounded-full border-2 shrink-0"
                title="Другой цвет"
                style={{ background:(selectedItem as TextItem).color,
                  borderColor: !["#1a1a1a","#e05030","#4a80f0","#2a9d5c","#e0a020","#9b59b6","#ffffff"].includes((selectedItem as TextItem).color) ? "#4a80f0" : "var(--brown-pale)" }}/>
            </>
          )}
          {/* Frame properties */}
          {selectedItem.type === "frame" && !selectedItem.locked && (
            <>
              <div className="w-px h-5 shrink-0" style={{ background:"var(--brown-pale)" }}/>
              {/* Frame border color popup trigger */}
              <button
                onClick={e => { const r=(e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setPickerPos({x:r.left,y:r.top}); setOpenPicker(p => p==="frameBorder"?null:"frameBorder"); }}
                className="w-6 h-6 rounded-full border-2 shrink-0"
                title="Цвет рамки"
                style={{ background:(selectedItem as FrameItem).color,
                  borderColor: openPicker==="frameBorder" ? "#4a80f0" : "var(--brown-pale)" }}/>
              {/* Frame fill color popup trigger */}
              <button
                onClick={e => { const r=(e.currentTarget as HTMLButtonElement).getBoundingClientRect(); setPickerPos({x:r.left,y:r.top}); setOpenPicker(p => p==="frameFill"?null:"frameFill"); }}
                className="w-6 h-6 rounded-lg border-2 shrink-0"
                title="Заливка"
                style={{ background:(selectedItem as FrameItem).bgColor,
                  borderColor: openPicker==="frameFill" ? "#4a80f0" : "var(--brown-pale)" }}/>
              <div className="w-px h-4 shrink-0" style={{ background:"var(--brown-pale)" }}/>
              <span className="text-xs shrink-0" style={{ color:"var(--brown-mid)" }}>Прозрачность</span>
              <input type="range" min={10} max={100} step={5}
                value={(selectedItem as FrameItem).opacity ?? 100}
                onChange={e => updateBoardItem({...selectedItem as FrameItem, opacity:+e.target.value})}
                className="w-20 h-1 accent-blue-400 shrink-0"/>
              <span className="text-xs w-7 tabular-nums shrink-0" style={{ color:"var(--brown-mid)" }}>
                {(selectedItem as FrameItem).opacity ?? 100}%
              </span>
              {(role === "tutor" || currentStudentId) && (() => {
                const fi = selectedItem as FrameItem;
                const isPrivate = !!fi.private;
                return (
                  <>
                    <div className="w-px h-4 shrink-0" style={{ background:"var(--brown-pale)" }}/>
                    <button
                      onClick={() => {
                        const next = isPrivate
                          ? { ...fi, private: false, ownerStudentId: undefined }
                          : { ...fi, private: true, ownerStudentId: currentStudentId ?? fi.ownerStudentId };
                        updateBoardItem(next);
                      }}
                      className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg border font-medium shrink-0"
                      style={{
                        borderColor: isPrivate ? "#c07020" : "var(--brown-pale)",
                        background:  isPrivate ? "#fff8e0" : "transparent",
                        color:       isPrivate ? "#c07020" : "var(--brown-mid)",
                      }}>
                      {isPrivate ? "🔒 Личный" : "🔓 Общий"}
                    </button>
                    {isPrivate && role === "tutor" && students.length > 0 && (
                      <select
                        value={fi.ownerStudentId ?? ""}
                        onChange={e => updateBoardItem({ ...fi, ownerStudentId: e.target.value || undefined })}
                        onMouseDown={e => e.stopPropagation()}
                        className="text-xs px-2 py-0.5 rounded-lg border outline-none shrink-0"
                        style={{ borderColor: "#c07020", background: "#fff8e0", color: "#c07020", maxWidth: 120 }}>
                        <option value="">— чей фрейм —</option>
                        {students.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                  </>
                );
              })()}
            </>
          )}
          <div className="flex-1"/>
          {/* Delete */}
          <button
            onClick={() => {
              const toRemove = new Set(selectedIds.size > 0 ? selectedIds : [selectedItem.id]);
              pushHistory({ type:"clear", saved:[...itemsRef.current] });
              itemsRef.current = itemsRef.current.filter(i => !toRemove.has(i.id));
              render(); send({ type:"clear" });
              itemsRef.current.forEach(item => send({ type:"path", item }));
              setSelectedId(null);
              setSelectedIds(new Set());
            }}
            className="rounded-lg px-3 py-1 text-xs font-medium text-white hover:opacity-80 flex items-center gap-1 shrink-0"
            style={{ background:"#e05030", minHeight:28 }}>
            <Trash2 size={12}/> Удалить
          </button>
        </div>
      )}

      {/* Color picker portal — renders in document.body to escape overflow-hidden/overflow-x-auto ancestors */}
      {openPicker && pickerPos && createPortal(
        <div ref={pickerRef}
          className="p-3 rounded-xl border shadow-xl"
          style={{
            position: "fixed",
            left: pickerPos.x,
            bottom: window.innerHeight - pickerPos.y + 8,
            zIndex: 9999,
            background: "white",
            borderColor: "var(--brown-pale)",
            minWidth: 164,
          }}
          onMouseDown={e => e.stopPropagation()}>
          {openPicker === "textCustom" && selectedItem?.type === "text" && (
            <>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {(["#1a1a1a","#e05030","#4a80f0","#2a9d5c","#e0a020","#9b59b6","#9040c0","#20a0a0","#ffffff","#888888"] as const).map(c => (
                  <button key={c}
                    onClick={() => { updateBoardItem({...selectedItem as TextItem, color: c}); setOpenPicker(null); }}
                    className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                    style={{ background:c, borderColor:(selectedItem as TextItem).color===c?"#4a80f0":"transparent",
                      boxShadow: c==="#ffffff"?"inset 0 0 0 1px #bbb":undefined }}/>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="w-7 h-7 rounded-lg border-2 relative overflow-hidden shrink-0"
                  style={{ borderColor:"var(--brown-pale)", background:(selectedItem as TextItem).color }}>
                  <input type="color" value={(selectedItem as TextItem).color}
                    onChange={e => updateBoardItem({...selectedItem as TextItem, color: e.target.value})}
                    className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/>
                </div>
                <span className="text-xs" style={{ color:"var(--brown-light)" }}>Свой цвет</span>
              </label>
            </>
          )}
          {openPicker === "frameBorder" && selectedItem?.type === "frame" && (
            <>
              <p className="text-xs mb-2 font-medium" style={{ color:"var(--brown-mid)" }}>Цвет рамки</p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {FRAME_COLORS.map(c => (
                  <button key={c}
                    onClick={() => { updateBoardItem({...selectedItem as FrameItem, color:c}); setOpenPicker(null); }}
                    className="w-6 h-6 rounded-full border-2 transition-all hover:scale-110"
                    style={{ background:c, borderColor:(selectedItem as FrameItem).color===c?"#4a80f0":"transparent" }}/>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="w-7 h-7 rounded-lg border-2 relative overflow-hidden shrink-0"
                  style={{ borderColor:"var(--brown-pale)", background:(selectedItem as FrameItem).color }}>
                  <input type="color" value={(selectedItem as FrameItem).color}
                    onChange={e => updateBoardItem({...selectedItem as FrameItem, color:e.target.value})}
                    className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/>
                </div>
                <span className="text-xs" style={{ color:"var(--brown-light)" }}>Свой цвет</span>
              </label>
            </>
          )}
          {openPicker === "frameFill" && selectedItem?.type === "frame" && (
            <>
              <p className="text-xs mb-2 font-medium" style={{ color:"var(--brown-mid)" }}>Заливка</p>
              <div className="flex gap-1.5 flex-wrap mb-2">
                {["#ffffff","#f5f0e8","#e8f0ff","#e8ffe8","#fff8e0","#ffe8e8","#f0e8ff","#e8f8ff"].map(c => (
                  <button key={c}
                    onClick={() => { updateBoardItem({...selectedItem as FrameItem, bgColor:c}); setOpenPicker(null); }}
                    className="w-6 h-6 rounded-md border-2 transition-all hover:scale-110"
                    style={{ background:c, borderColor:(selectedItem as FrameItem).bgColor===c?"#4a80f0":"#e0d8d0" }}/>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <div className="w-7 h-7 rounded-lg border-2 relative overflow-hidden shrink-0"
                  style={{ borderColor:"var(--brown-pale)", background:(selectedItem as FrameItem).bgColor }}>
                  <input type="color" value={(selectedItem as FrameItem).bgColor}
                    onChange={e => updateBoardItem({...selectedItem as FrameItem, bgColor:e.target.value})}
                    className="absolute opacity-0 inset-0 w-full h-full cursor-pointer"/>
                </div>
                <span className="text-xs" style={{ color:"var(--brown-light)" }}>Свой цвет</span>
              </label>
            </>
          )}
        </div>,
        document.body
      )}

      {/* Mobile toolbar */}
      <div className="flex sm:hidden flex-col border-t shrink-0" data-no-prevent style={{ borderColor:"var(--brown-pale)", background:"white", paddingBottom:"env(safe-area-inset-bottom)" }}
        onPointerDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
        {/* Row 1: tools + controls */}
        <div className="flex items-center gap-1 px-2 py-1.5 border-b overflow-x-auto" style={{ borderColor:"var(--brown-pale)", touchAction:"pan-x" }}>
          {([
            { t:"select" as Tool, icon:<Pointer size={19}/> },
            { t:"pen" as Tool,       icon:<Pencil size={19}/> },
            { t:"highlight" as Tool, icon:<Highlighter size={19}/> },
            { t:"eraser" as Tool,    icon:<Eraser size={19}/> },
            { t:"text" as Tool,      icon:<Type size={19}/> },
            { t:"laser" as Tool,     icon:<MousePointer2 size={19}/> },
            { t:"hand" as Tool,      icon:<Hand size={19}/> },
          ] as const).map(({ t, icon }) => (
            <ToolBtn key={t} active={tool===t}
              onClick={() => { commitText(); pickTool(t); }}
              title="">{icon}</ToolBtn>
          ))}
          {/* Shapes */}
          <ToolBtn active={tool==="shape"} onClick={() => { commitText(); setTool("shape"); setShowShapeMenu(false); }} title="">
            <Shapes size={19}/>
          </ToolBtn>
          {/* Image */}
          <ToolBtn active={false} onClick={() => { commitText(); pickTool("image"); setImgDialog(true); }} title="">
            <ImagePlus size={19}/>
          </ToolBtn>
          {/* More tools "+" */}
          <ToolBtn active={showMoreTools} onClick={() => setShowMoreTools(v => !v)} title="">
            <span className="text-base font-bold leading-none">+</span>
          </ToolBtn>
          <div className="flex-1 shrink-0 min-w-2"/>
          {role==="tutor" && (
            <>
              <button onClick={bringToMe} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border-2 font-medium shrink-0"
                style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}>
                <Navigation size={12}/> Ко мне
              </button>
              <button onClick={findStudent} disabled={!hasRemoteViewport}
                className="p-2 rounded-lg border disabled:opacity-30 shrink-0"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}
                title="Найти ученика">
                <LocateFixed size={14}/>
              </button>
            </>
          )}
          <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg border disabled:opacity-25 shrink-0" style={{ borderColor:"var(--brown-pale)" }}><Undo2 size={16} style={{ color:"var(--brown-dark)" }}/></button>
          <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg border disabled:opacity-25 shrink-0" style={{ borderColor:"var(--brown-pale)" }}><Redo2 size={16} style={{ color:"var(--brown-dark)" }}/></button>
          <button onClick={() => applyView(1,0,0)} className="p-2 rounded-lg border shrink-0" style={{ borderColor:"var(--brown-pale)" }}><Maximize2 size={16} style={{ color:"var(--brown-dark)" }}/></button>
        </div>
        {/* More tools panel */}
        {showMoreTools && (
          <div className="flex items-center gap-1.5 px-2 py-2 border-b overflow-x-auto" style={{ borderColor:"var(--brown-pale)", touchAction:"pan-x" }}>
            <button onClick={()=>{setShowSymbols(v=>!v);setShowMoreTools(false);}}
              onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-lg">∑</span><span className="text-xs">Символы</span>
            </button>
            <button onClick={()=>{setShowDice(v=>!v);setShowMoreTools(false);}}
              onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-lg">🎲</span><span className="text-xs">Кубик</span>
            </button>
            <button onClick={()=>{setShowWheel(v=>!v);setShowMoreTools(false);}}
              onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-lg">🎡</span><span className="text-xs">Колесо</span>
            </button>
            <button onClick={()=>{setShowFnPanel(v=>!v);setShowMoreTools(false);}}
              onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-sm font-bold font-mono leading-none mb-0.5">f(x)</span><span className="text-xs">График</span>
            </button>
            {!profileHide.has("formula") && (
              <button onClick={()=>{setShowFormulaPanel(v=>!v);setShowMoreTools(false);}}
                onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                <span className="text-base font-bold leading-none">∑</span><span className="text-xs">Формула</span>
              </button>
            )}
            {!profileHide.has("code") && (
              <button onClick={()=>{setShowCodePanel(v=>!v);setShowMoreTools(false);}}
                onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                <span className="text-xs font-bold font-mono leading-none mb-0.5">{"</>"}</span><span className="text-xs">Код</span>
              </button>
            )}
            {role==="tutor" && (
              <button onClick={()=>{setShowTablePicker(v=>!v);setShowMoreTools(false);}}
                onTouchEnd={e=>{e.preventDefault();e.stopPropagation();(e.currentTarget as HTMLButtonElement).click();}}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                <span className="text-lg">⊞</span><span className="text-xs">Таблица</span>
              </button>
            )}
            {role==="tutor" && (
              <label className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0 cursor-pointer"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                <FileText size={20}/><span className="text-xs">PDF</span>
                <input type="file" accept=".pdf,application/pdf" className="hidden"
                  onChange={e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";setShowMoreTools(false);openPdfPicker(URL.createObjectURL(f));}}/>
              </label>
            )}
            {role==="tutor" && (
              <label className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0 cursor-pointer"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                <span className="text-lg">🎬</span><span className="text-xs">Видео</span>
                <input type="file" accept="video/*" className="hidden"
                  onChange={e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";setShowMoreTools(false);uploadAndAddVideo(f);}}/>
              </label>
            )}
          </div>
        )}
        {/* Row 2: context — sizes + colors / shapes / ruling */}
        <div className="flex items-center gap-2 px-2 py-1.5 overflow-x-auto" style={{ touchAction:"pan-x" }}>
          {/* Text tool hint */}
          {tool==="text" && !textInput && (
            <div className="flex items-center gap-2 text-xs shrink-0" style={{ color:"var(--brown-light)" }}>
              <Type size={13} style={{ color:"var(--brown-mid)" }}/>
              Нажмите на доску, чтобы добавить текст
            </div>
          )}
          {/* Brush sizes for pen/highlight/eraser/shape */}
          {(tool==="pen"||tool==="eraser"||tool==="highlight"||tool==="shape") && (
            <div className="flex gap-1 shrink-0">
              {SIZES.map(s => (
                <button key={s} onClick={() => setSize(s)}
                  className="flex items-center justify-center rounded-full border-2 shrink-0 transition-all"
                  style={{ width:38, height:38, borderColor:size===s?"var(--brown-dark)":"var(--brown-pale)", opacity:size===s?1:0.4 }}>
                  <div className="rounded-full" style={{ width:Math.min(s+2,22), height:Math.min(s+2,22), background:"var(--brown-dark)" }}/>
                </button>
              ))}
            </div>
          )}
          {/* Shape kind picker */}
          {tool==="shape" && (
            <div className="flex gap-1 shrink-0">
              <div className="w-px mx-0.5 self-stretch" style={{ background:"var(--brown-pale)" }}/>
              {SHAPE_KINDS.map(k => (
                <button key={k.v} onClick={() => setShapeKind(k.v)}
                  className="w-10 h-10 rounded-lg border-2 text-base flex items-center justify-center shrink-0 transition-all"
                  style={{ borderColor:shapeKind===k.v?"var(--brown-dark)":"transparent", opacity:shapeKind===k.v?1:0.45 }}
                  title={k.label}>
                  {k.icon}
                </button>
              ))}
            </div>
          )}
          {/* Color swatches + custom picker */}
          {(tool==="pen"||tool==="eraser"||tool==="shape") && (
            <div className="flex gap-1.5 items-center shrink-0">
              <div className="w-px mx-0.5 self-stretch" style={{ background:"var(--brown-pale)" }}/>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="rounded-full border-2 shrink-0"
                  style={{ width:34,height:34,background:c,borderColor:color===c?"var(--brown-dark)":"transparent",boxShadow:c==="#ffffff"?"inset 0 0 0 1px #bbb":undefined }}/>
              ))}
              <label className="relative rounded-full border-2 shrink-0 overflow-hidden cursor-pointer"
                style={{ width:34,height:34,borderColor:!COLORS.includes(color)?"var(--brown-dark)":"var(--brown-pale)",background:color }}
                title="Свой цвет">
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
              </label>
            </div>
          )}
          {tool==="highlight" && (
            <div className="flex gap-1.5 items-center shrink-0">
              <div className="w-px mx-0.5 self-stretch" style={{ background:"var(--brown-pale)" }}/>
              {HIGHLIGHT_COLORS.map(c => (
                <button key={c} onClick={() => setHlColor(c)}
                  className="rounded-full border-2 shrink-0"
                  style={{ width:34,height:34,background:c,borderColor:hlColor===c?"var(--brown-dark)":"transparent" }}/>
              ))}
              <label className="relative rounded-full border-2 shrink-0 overflow-hidden cursor-pointer"
                style={{ width:34,height:34,borderColor:!HIGHLIGHT_COLORS.includes(hlColor)?"var(--brown-dark)":"var(--brown-pale)",background:hlColor }}
                title="Свой цвет">
                <input type="color" value={hlColor} onChange={e => setHlColor(e.target.value)}
                  className="absolute opacity-0 w-full h-full cursor-pointer" style={{ top:0,left:0 }}/>
              </label>
            </div>
          )}
          {/* Ruling + clear (always at end) */}
          <div className="flex gap-0.5 ml-auto items-center shrink-0">
            {RULING_OPTIONS.map(({ v, title }) => (
              <button key={v} onClick={() => setRuling(v)} title={title}
                className="flex items-center justify-center rounded-lg border-2"
                style={{ width:36, height:36, borderColor:ruling===v?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity:ruling===v?1:0.4 }}>
                <RulingIcon v={v}/>
              </button>
            ))}
            {(ruling==="lines"||ruling==="grid"||ruling==="calligraphy") && (
              <div className="flex gap-0.5 ml-1">
                {(["S","M","L"] as RulingSize[]).map(sz => (
                  <button key={sz} onClick={() => setSzRuling(sz)}
                    className="text-xs font-bold rounded border-2"
                    style={{ width:32, height:32, borderColor:rulingSize===sz?"var(--brown-dark)":"var(--brown-pale)", color:"var(--brown-dark)", opacity:rulingSize===sz?1:0.4 }}>
                    {sz}
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={handleClear} className="p-2 rounded-lg border shrink-0" style={{ borderColor:"#f0c0b0", color:"#c06040" }}><Trash2 size={17}/></button>
        </div>
      </div>
      </div>
      {/* PDF page picker dialog */}
      {pdfPicker && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4"
          style={{ background:"rgba(0,0,0,0.5)" }}
          onClick={e => { if (e.target === e.currentTarget) setPdfPicker(null); }}>
          <div className="w-full max-w-2xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col"
            style={{ background:"white", borderColor:"var(--brown-pale)", maxHeight:"85vh" }}>
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b shrink-0"
              style={{ borderColor:"var(--brown-pale)" }}>
              <FileText size={16} style={{ color:"var(--brown-dark)" }}/>
              <span className="font-semibold text-sm" style={{ color:"var(--brown-dark)" }}>
                Выберите страницы
              </span>
              <span className="text-xs" style={{ color:"var(--brown-light)" }}>
                ({pdfPicker.total} стр.) · нажмите на страницу для выбора
              </span>
              <button onClick={() => setPdfPicker(null)}
                className="ml-auto p-1 rounded hover:opacity-60" style={{ color:"var(--brown-light)" }}>
                <X size={16}/>
              </button>
            </div>
            {/* Quick select */}
            <div className="flex items-center gap-2 px-4 py-2 border-b text-xs shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-mid)" }}>
              <button onClick={() => setPdfPicker(p => p ? { ...p, selected: new Set(Array.from({length:p.total},(_,i)=>i+1)) } : p)}
                className="px-2 py-0.5 rounded border hover:opacity-70"
                style={{ borderColor:"var(--brown-pale)" }}>Все</button>
              <button onClick={() => setPdfPicker(p => p ? { ...p, selected: new Set() } : p)}
                className="px-2 py-0.5 rounded border hover:opacity-70"
                style={{ borderColor:"var(--brown-pale)" }}>Снять</button>
              <span className="ml-auto">Выбрано: {pdfPicker.selected.size}</span>
            </div>
            {/* Thumbnails */}
            <div className="flex-1 overflow-y-auto p-3">
              <div className="grid grid-cols-4 gap-3">
                {pdfPicker.thumbs.map((thumb, i) => {
                  const pageNum = i + 1;
                  const sel = pdfPicker.selected.has(pageNum);
                  return (
                    <button key={pageNum} onClick={() => setPdfPicker(p => {
                      if (!p) return p;
                      const next = new Set(p.selected);
                      sel ? next.delete(pageNum) : next.add(pageNum);
                      return { ...p, selected: next };
                    })}
                      className="relative rounded-xl overflow-hidden border-2 transition-all flex flex-col"
                      style={{ borderColor: sel ? "#4a80f0" : "var(--brown-pale)",
                        boxShadow: sel ? "0 0 0 2px #4a80f055" : undefined }}>
                      <div className="w-full aspect-[3/4] bg-gray-100 flex items-center justify-center">
                        {thumb ? (
                          <img src={thumb} alt={`с.${pageNum}`} className="w-full h-full object-contain"/>
                        ) : (
                          <span className="text-xs" style={{ color:"var(--brown-light)" }}>...</span>
                        )}
                      </div>
                      <div className="py-1 text-center text-xs" style={{ color: sel?"#4a80f0":"var(--brown-mid)", fontWeight: sel?600:400 }}>
                        с. {pageNum}
                      </div>
                      {sel && (
                        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ background:"#4a80f0" }}>✓</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center gap-3 px-4 py-3 border-t shrink-0"
              style={{ borderColor:"var(--brown-pale)" }}>
              <button onClick={() => setPdfPicker(null)}
                className="px-4 py-2 rounded-xl border text-sm"
                style={{ borderColor:"var(--brown-pale)", color:"var(--brown-light)" }}>
                Отмена
              </button>
              <button
                disabled={pdfPicker.selected.size === 0 || pdfPickerLoading}
                onClick={() => addPdfPagesToBoard(pdfPicker)}
                className="ml-auto px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                style={{ background:"var(--gradient-primary)" }}>
                {pdfPickerLoading ? "Добавляю..." : `Добавить ${pdfPicker.selected.size > 0 ? pdfPicker.selected.size + " стр." : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen video */}
      {fullscreenVideo && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background:"rgba(0,0,0,0.92)" }}>
          <video src={fullscreenVideo} controls autoPlay className="max-w-full max-h-full"
            style={{ maxHeight:"90vh" }}/>
          <button onClick={() => setFullscreenVideo(null)}
            className="absolute top-4 right-4 p-2 rounded-full text-white hover:opacity-70"
            style={{ background:"rgba(255,255,255,0.15)" }}>
            <X size={22}/>
          </button>
        </div>
      )}
    </div>
  );
});
WhiteboardCanvas.displayName = "WhiteboardCanvas";
export default WhiteboardCanvas;

function FlipCard({ sx, sy, sw, sh, rotation, word, translation, fromHidden }:
  { sx:number; sy:number; sw:number; sh:number; rotation:number; word:string; translation:string; fromHidden:boolean }) {
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { const t = requestAnimationFrame(() => setFlipped(true)); return () => cancelAnimationFrame(t); }, []);
  const deg = flipped ? (fromHidden ? 180 : 0) : (fromHidden ? 0 : 180);
  return (
    <div style={{
      position:"fixed", left:sx, top:sy, width:sw, height:sh,
      transform:`rotate(${rotation}deg)`, transformOrigin:"center center",
      perspective:600, pointerEvents:"none", zIndex:9999,
    }}>
      <div style={{
        width:"100%", height:"100%",
        transform:`rotateY(${deg}deg)`, transition:"transform 0.35s ease",
        transformStyle:"preserve-3d", position:"relative",
      }}>
        {/* Front (hidden face) */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          background:"white", borderRadius:8, border:"1px solid rgba(0,0,0,0.12)",
          display:"flex", alignItems:"center", justifyContent:"center",
        }}>
          <span style={{ fontSize:"1.4rem", color:"var(--brown-light,#b8956a)" }}>✦</span>
        </div>
        {/* Back (visible face) */}
        <div style={{
          position:"absolute", inset:0, backfaceVisibility:"hidden",
          transform:"rotateY(180deg)",
          background:"white", borderRadius:8, border:"1px solid rgba(0,0,0,0.12)",
          display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:4, padding:"6px 8px",
        }}>
          <span style={{ fontSize:"0.75rem", fontWeight:700, color:"#3b2a1a", textAlign:"center" }}>{word}</span>
          <div style={{ width:"70%", height:1, background:"rgba(0,0,0,0.1)" }}/>
          <span style={{ fontSize:"0.7rem", color:"#7c5c3e", textAlign:"center" }}>{translation}</span>
        </div>
      </div>
    </div>
  );
}

function LaserDot({ sx, sy, color }: { sx:number; sy:number; color:string }) {
  return (
    <div className="absolute pointer-events-none" style={{ left:sx, top:sy, transform:"translate(-50%,-50%)" }}>
      <div className="animate-ping absolute" style={{ width:32,height:32,borderRadius:"50%",background:color,opacity:0.3,left:-16,top:-16 }}/>
      <div style={{ width:14,height:14,borderRadius:"50%",background:color,border:"2px solid white",boxShadow:`0 0 8px ${color}` }}/>
    </div>
  );
}
function ToolBtn({ active, onClick, title, children }: { active:boolean; onClick:()=>void; title:string; children:React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-lg border-2 shrink-0 transition-all"
      style={{ borderColor:active?"var(--brown-dark)":"transparent", color:"var(--brown-dark)", opacity:active?1:0.5 }}>
      {children}
    </button>
  );
}
function Sep() { return <div className="w-px h-5 shrink-0" style={{ background:"var(--brown-pale)" }}/>; }
function SideBtn({ active, onClick, title, children }: { active?:boolean; onClick:()=>void; title:string; children:React.ReactNode }) {
  const shortcut = title.match(/\[([A-Z0-9])\]/)?.[1];
  return (
    <div className="relative group">
      <button onClick={onClick} aria-label={title}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all relative"
        style={{ background: active?"var(--brown-pale)":"transparent",
          color: active?"var(--brown-dark)":"var(--brown-light)",
          border: active?"2px solid var(--brown-dark)":"2px solid transparent" }}>
        {children}
        {shortcut && (
          <span className="absolute bottom-0.5 right-1 text-[8px] font-bold leading-none select-none"
            style={{ color: active ? "var(--brown-dark)" : "var(--brown-light)", opacity: 0.65 }}>
            {shortcut}
          </span>
        )}
      </button>
      {/* Custom tooltip — only on pointer devices, hidden on touch */}
      <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-[300]
        pointer-events-none select-none
        opacity-0 group-hover:opacity-100 transition-opacity duration-100
        [@media(hover:hover)]:block hidden"
        style={{ filter:"drop-shadow(0 2px 6px rgba(0,0,0,.18))" }}>
        <div className="absolute right-full top-1/2 -translate-y-1/2"
          style={{ width:0, height:0,
            borderTop:"5px solid transparent", borderBottom:"5px solid transparent",
            borderRight:"5px solid #1f2937" }}/>
        <div className="rounded-lg px-2.5 py-1.5 text-xs whitespace-nowrap leading-tight"
          style={{ background:"#1f2937", color:"#f9fafb", fontFamily:"inherit" }}>
          {title}
        </div>
      </div>
    </div>
  );
}

// ── DiceFaceSvg ───────────────────────────────────────────────────────────────
const DICE_PIPS: Record<number, [number,number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.75, 0.25], [0.25, 0.75]],
  3: [[0.75, 0.25], [0.5, 0.5], [0.25, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.25], [0.25, 0.5], [0.25, 0.75], [0.75, 0.25], [0.75, 0.5], [0.75, 0.75]],
};
function DiceFaceSvg({ value, size, rolling }: { value: number; size: number; rolling?: boolean }) {
  const pips = DICE_PIPS[value] ?? DICE_PIPS[1];
  return (
    <svg width={size} height={size} viewBox="0 0 100 100"
      style={{ filter: rolling ? "blur(2px)" : "none", transition:"filter 0.08s", flexShrink:0 }}>
      <rect x={3} y={3} width={94} height={94} rx={18} ry={18} fill="white"/>
      {pips.map(([cx, cy], i) => (
        <circle key={i} cx={cx*100} cy={cy*100} r={9} fill="#3D0C15"/>
      ))}
    </svg>
  );
}

// ── DiceOverlay ───────────────────────────────────────────────────────────────
function DiceOverlay({ item, sp, sw, sh, selected, onRoll }:
  { item: DiceItem; sp:{x:number;y:number}; sw:number; sh:number; selected:boolean; onRoll:(r:number[])=>void }) {
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState(item.result.length > 0 ? item.result : Array(item.count).fill(1));
  const touchRef = useRef({ y: 0, t: 0 });

  useEffect(() => { if (item.result.length > 0) setDisplay(item.result); }, [item.result]);

  const roll = () => {
    if (rolling) return;
    setRolling(true);
    let n = 0;
    const id = setInterval(() => {
      setDisplay(Array.from({length:item.count},()=>Math.ceil(Math.random()*6)));
      n++;
      if (n >= 12) {
        clearInterval(id);
        const res = Array.from({length:item.count},()=>Math.ceil(Math.random()*6));
        setDisplay(res); onRoll(res); setRolling(false);
      }
    }, 70);
  };

  const diceSize = Math.min(Math.floor((sw - 16) / item.count) - 4, Math.floor(sh * 0.55), 64);

  return (
    <div className="absolute flex flex-col items-center justify-center rounded-2xl select-none"
      style={{ left:sp.x, top:sp.y, width:sw, height:sh, zIndex:20,
        background:"#f8f0e4",
        boxShadow: selected ? "0 0 0 2px #4a80f0, 0 4px 16px rgba(59,42,26,0.14)" : "0 4px 16px rgba(59,42,26,0.14)" }}
      onTouchStart={e => { touchRef.current = { y:e.touches[0].clientY, t:Date.now() }; e.stopPropagation(); }}
      onTouchEnd={e => { e.stopPropagation(); const dy=touchRef.current.y-e.changedTouches[0].clientY; if(Math.abs(dy)>35)roll(); }}>
      <div className="flex gap-2 justify-center flex-wrap px-2 mb-1">
        {display.map((v,i) => (
          <DiceFaceSvg key={i} value={v} size={diceSize} rolling={rolling}/>
        ))}
      </div>
      {item.count > 1 && !rolling && (
        <div style={{ color:"var(--brown-light)", fontSize:11 }}>= {display.reduce((a,b)=>a+b,0)}</div>
      )}
      <button onClick={e=>{e.stopPropagation();roll();}} disabled={rolling}
        className="mt-1 px-3 py-0.5 rounded-lg text-xs font-medium"
        style={{ background:rolling?"var(--brown-pale)":"var(--gradient-primary)", color:rolling?"var(--brown-mid)":"#fff", opacity:rolling?0.7:1 }}>
        {rolling?"...":"Бросить"}
      </button>
    </div>
  );
}

// ── WheelOverlay ──────────────────────────────────────────────────────────────
function WheelOverlay({ item, sp, sw, sh, selected, onAngleUpdate, onEdit }:
  { item: WheelItem; sp:{x:number;y:number}; sw:number; sh:number; selected:boolean;
    onAngleUpdate:(a:number)=>void; onEdit:()=>void }) {
  const cvRef = useRef<HTMLCanvasElement>(null);
  const [angle, setAngle] = useState(item.angle);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<string|null>(null);
  const touchRef = useRef({ y:0, t:0 });

  const drawW = useCallback((a: number) => {
    const cv = cvRef.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const W = cv.width, H = cv.height, cx = W/2, cy = H/2, r = Math.min(cx,cy)-3;
    const its = item.items; if (!its.length) return;
    const slice = (Math.PI*2)/its.length;
    ctx.clearRect(0,0,W,H);
    its.forEach((txt,i) => {
      const s=a+i*slice, e=s+slice;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,s,e); ctx.closePath();
      ctx.fillStyle=`hsl(${i*360/its.length},65%,62%)`; ctx.fill();
      ctx.strokeStyle="#fff"; ctx.lineWidth=2; ctx.stroke();
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(s+slice/2);
      ctx.textAlign="right"; ctx.textBaseline="middle";
      ctx.fillStyle="#fff";
      const fsize=Math.min(13,Math.max(8,80/its.length+4));
      ctx.font=`bold ${fsize}px Arial`;
      ctx.fillText(txt.length>12?txt.slice(0,11)+"…":txt, r-6, 0);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx,cy,11,0,Math.PI*2); ctx.fillStyle="#fff"; ctx.fill();
    ctx.save(); ctx.translate(W-1,cy);
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(-16,-8); ctx.lineTo(-16,8); ctx.closePath();
    ctx.fillStyle="#333"; ctx.fill(); ctx.restore();
  }, [item.items]);

  useEffect(() => { setAngle(item.angle); }, [item.angle]);
  useEffect(() => { drawW(angle); }, [angle, drawW]);

  const spin = () => {
    if (spinning || item.items.length < 2) return;
    setResult(null); setSpinning(true);
    const extra = 5+Math.random()*5;
    const final = angle+extra*Math.PI*2+Math.random()*Math.PI*2;
    const dur=3500, start=performance.now(), startA=angle;
    const easeOut=(t:number)=>1-Math.pow(1-t,3);
    const anim=(now:number) => {
      const t=Math.min(1,(now-start)/dur);
      const a=startA+(final-startA)*easeOut(t);
      setAngle(a); drawW(a);
      if(t<1){ requestAnimationFrame(anim); return; }
      setSpinning(false);
      const norm=(((-a%(Math.PI*2))+Math.PI*2)%(Math.PI*2));
      const idx=Math.floor(norm/((Math.PI*2)/item.items.length))%item.items.length;
      setResult(item.items[idx]); onAngleUpdate(a);
    };
    requestAnimationFrame(anim);
  };

  const size = Math.min(sw-4, sh-52, 300);

  return (
    <div className="absolute flex flex-col items-center justify-between rounded-xl select-none overflow-hidden py-2"
      style={{ left:sp.x, top:sp.y, width:sw, height:sh, zIndex:20, background:"white",
        outline: selected ? "2px solid #4a80f0" : "1px solid #e0d8d0" }}
      onTouchStart={e=>{ touchRef.current={y:e.touches[0].clientY,t:Date.now()}; e.stopPropagation(); }}
      onTouchEnd={e=>{ e.stopPropagation(); const dy=touchRef.current.y-e.changedTouches[0].clientY; if(Math.abs(dy)>35)spin(); }}>
      <canvas ref={cvRef} width={size} height={size} className="shrink-0"/>
      {result && (
        <div className="text-xs font-bold px-2 py-0.5 rounded-full mx-2"
          style={{ background:"var(--brown-pale)", color:"var(--brown-dark)", textAlign:"center" }}>
          🎉 {result}
        </div>
      )}
      <div className="flex gap-1 shrink-0 pb-0.5">
        <button onClick={e=>{e.stopPropagation();spin();}} disabled={spinning}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ background:"#4a80f0" }}>
          {spinning?"...":"Крутить"}
        </button>
        <button onClick={e=>{e.stopPropagation();onEdit();}}
          className="px-2.5 py-1 rounded-lg text-xs border"
          style={{ borderColor:"var(--brown-pale)", color:"var(--brown-mid)" }}>
          ✎
        </button>
      </div>
    </div>
  );
}

// ── TableOverlay ──────────────────────────────────────────────────────────────
function TableOverlay({ item, sp, sw, sh, selected, zoom, onCellChange }:
  { item: TableItem; sp:{x:number;y:number}; sw:number; sh:number; selected:boolean;
    zoom:number; onCellChange:(r:number,c:number,text:string)=>void }) {
  const [editing, setEditing] = useState<{r:number;c:number}|null>(null);
  const [val, setVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const cellH = sh / item.rows;
  const cellW = sw / item.cols;
  const fs = (item.fontSize ?? 13) * zoom;

  const startEdit = (r: number, c: number) => {
    setEditing({r,c}); setVal(item.data[r]?.[c] ?? "");
    setTimeout(()=>inputRef.current?.focus(), 30);
  };
  const commit = () => {
    if (!editing) return;
    onCellChange(editing.r, editing.c, val);
    setEditing(null);
  };

  return (
    <div className="absolute overflow-hidden select-none"
      style={{ left:sp.x, top:sp.y, width:sw, height:sh, zIndex:20,
        outline: selected ? "2px solid #4a80f0" : "1px solid #c0b8b0",
        borderRadius:4, background:"white" }}>
      {Array.from({length:item.rows}).map((_,r) => (
        <div key={r} className="flex" style={{ height:cellH }}>
          {Array.from({length:item.cols}).map((_,c) => {
            const isHeader = item.headerRow && r === 0;
            const isEdit = editing?.r===r && editing?.c===c;
            return (
              <div key={c} className="relative overflow-hidden border-r border-b"
                style={{ width:cellW, height:cellH, borderColor:"#c0b8b0",
                  background: isHeader ? "#f0ece8" : "white",
                  borderRight: c===item.cols-1?"none":undefined,
                  borderBottom: r===item.rows-1?"none":undefined }}>
                {isEdit ? (
                  <input ref={inputRef} value={val} onChange={e=>setVal(e.target.value)}
                    onBlur={commit}
                    onKeyDown={e=>{ if(e.key==="Enter"||e.key==="Tab"){e.preventDefault();commit();} if(e.key==="Escape")setEditing(null); }}
                    className="absolute inset-0 w-full h-full px-1 outline-none text-center bg-blue-50"
                    style={{ fontSize:fs, fontWeight: isHeader?600:400 }}/>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center px-1 cursor-text overflow-hidden"
                    style={{ fontSize:fs, fontWeight: isHeader?600:400, color:"#1a1a1a" }}
                    onDoubleClick={e=>{ e.stopPropagation(); startEdit(r,c); }}>
                    {item.data[r]?.[c] ?? ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
