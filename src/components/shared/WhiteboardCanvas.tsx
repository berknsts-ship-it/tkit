"use client";

import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { flushSync } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import {
  Pencil, Eraser, Trash2, Type, Highlighter, MousePointer2,
  BookOpen, ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut,
  Maximize2, Hand, Navigation, Undo2, Redo2, Pointer, Lock, Unlock, ImagePlus, Link, FileText,
  Shapes, LayoutTemplate, Map as MapIcon, Minimize2, Magnet, Smile, Sparkles,
  ChevronsUp, ChevronsDown, ChevronUp, ChevronDown,
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
type DrawItem = PathItem | TextItem | ImageItem | ShapeItem | FrameItem | VideoItem | DiceItem | WheelItem | TableItem | FunctionItem;

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
  | { type: "ruling";  ruling: Ruling };

// ── image cache ───────────────────────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement>();
function getCachedImage(url: string, onLoad: () => void): HTMLImageElement | null {
  if (imgCache.has(url)) return imgCache.get(url)!;
  const img = new Image(); img.crossOrigin = "anonymous"; img.src = url;
  img.onload = () => { imgCache.set(url, img); onLoad(); };
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
function renderFrame(ctx: CanvasRenderingContext2D, item: FrameItem) {
  ctx.save();
  if (item.opacity !== undefined && item.opacity < 100) ctx.globalAlpha = item.opacity / 100;
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
    ctx.drawImage(img, item.x, item.y, item.w, item.h);
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

function renderItem(ctx: CanvasRenderingContext2D, item: DrawItem, zoom: number, onLoad?: () => void) {
  if (item.type === "path")    return renderPath(ctx, item);
  if (item.type === "image")   return renderImage(ctx, item, onLoad ?? (() => {}));
  if (item.type === "shape")   return renderShape(ctx, item);
  if (item.type === "frame")   return renderFrame(ctx, item);
  if (item.type === "function") return renderFunction(ctx, item, zoom);
  if (item.type === "video") {
    ctx.save();
    ctx.fillStyle = "#111"; ctx.fillRect(item.x, item.y, item.w, item.h);
    ctx.fillStyle = "rgba(255,255,255,0.15)";
    const vcx = item.x + item.w/2, vcy = item.y + item.h/2, vr = Math.min(item.w, item.h) * 0.18;
    ctx.beginPath(); ctx.moveTo(vcx + vr, vcy); ctx.arc(vcx, vcy, vr, 0, Math.PI*2); ctx.fill();
    ctx.restore(); return;
  }
  if (item.type === "dice" || item.type === "wheel") {
    ctx.save();
    ctx.strokeStyle = "#4a80f055"; ctx.lineWidth = 1;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.restore(); return;
  }
  if (item.type === "table") {
    ctx.save();
    ctx.strokeStyle = "#4a80f055"; ctx.lineWidth = 1;
    ctx.strokeRect(item.x, item.y, item.w, item.h);
    ctx.restore(); return;
  }
  renderText(ctx, item as TextItem);
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
const WhiteboardCanvas = forwardRef<WhiteboardRef, { roomId: string; role?: "tutor" | "student"; materials?: BoardMaterial[] }>(
function WhiteboardCanvas({ roomId, role = "student", materials = [] }, ref) {

  const containerRef    = useRef<HTMLDivElement>(null);
  const canvasRef       = useRef<HTMLCanvasElement>(null);
  const minimapRef      = useRef<HTMLCanvasElement>(null);
  const minimapMapRef   = useRef<{ minX:number; minY:number; scale:number; offX:number; offY:number } | null>(null);
  const renderMinimapFnRef = useRef<() => void>(() => {});
  const pdfOffscreen    = useRef<HTMLCanvasElement | null>(null);
  const channelRef      = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);

  const itemsRef      = useRef<DrawItem[]>([]);
  const livePathRef   = useRef<PathItem | null>(null);
  const remotePathsRef= useRef<Map<string, PathItem>>(new Map());
  const viewRef       = useRef({ zoom: 1, panX: 0, panY: 0 });
  const rulingRef     = useRef<Ruling>("none");
  const pdfPageRef    = useRef<number | null>(null); // null = no PDF active

  const [vpZoom,      setVpZoom]      = useState(100);
  const [ruling,      setRulingUI]    = useState<Ruling>("none");
  const [rulingSize,  setRulingSize]  = useState<RulingSize>("M");
  const rulingSizeRef = useRef<RulingSize>("M");
  const [connected,   setConnected]   = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [snapGrid,    setSnapGrid]    = useState(false);
  const [fnFormula,   setFnFormula]   = useState("");
  const [fnError,     setFnError]     = useState(false);
  const [showFnPanel, setShowFnPanel] = useState(false);
  const [isMobile,    setIsMobile]    = useState(false);

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

  // shape tool
  const [shapeKind,     setShapeKind]     = useState<ShapeKind>("rect");
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const [shapeFill,     setShapeFill]     = useState(false);
  const liveShapeRef = useRef<{ wx1: number; wy1: number; wx2: number; wy2: number } | null>(null);

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
  const [shapeMenuPos,  setShapeMenuPos]  = useState<{ top: number; left: number } | null>(null);
  const [frameMenuPos,  setFrameMenuPos]  = useState<{ top: number; left: number } | null>(null);
  const [moreToolsPos,  setMoreToolsPos]  = useState<{ top: number; left: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [pendingSymbol, setPendingSymbol]   = useState<string | null>(null);
  const [pendingSymbolPos, setPendingSymbolPos] = useState<{ sx: number; sy: number } | null>(null);
  const [touchDragging, setTouchDragging] = useState(false);

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
    if (rulingRef.current === "none") drawGrid(ctx, w, h, panX * dpr, panY * dpr, zoom * dpr);
    // World-space drawing: scale by dpr so 1 world unit = 1 CSS pixel
    ctx.save(); ctx.setTransform(zoom * dpr, 0, 0, zoom * dpr, panX * dpr, panY * dpr);
    drawRuling(ctx, rulingRef.current, w / dpr, h / dpr, zoom, panX, panY, rulingSizeRef.current);
    if (pdfOffscreen.current) ctx.drawImage(pdfOffscreen.current, 0, 0);
    for (const item of itemsRef.current) {
      if (item.id === editingIdRef.current) continue;
      const itemPage = item.pdfPage;
      if (itemPage !== undefined && pdfPageRef.current !== null && itemPage !== pdfPageRef.current) continue;
      renderItem(ctx, item, zoom, render);
    }
    if (livePathRef.current) renderPath(ctx, livePathRef.current);
    for (const [, rp] of remotePathsRef.current) renderPath(ctx, rp);
    // live shape preview while dragging
    if (liveShapeRef.current) {
      const ls = liveShapeRef.current;
      renderShape(ctx, {
        type: "shape", id: "__live__", shape: shapeKind,
        x1: ls.wx1, y1: ls.wy1, x2: ls.wx2, y2: ls.wy2,
        color, size, fill: shapeFill ? color + "33" : undefined,
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
          shape: frameShape, title: "",
          color: frameColor, bgColor: frameFill,
          opacity: frameOpacity, borderWidth: frameBorderWidth,
        });
      }
    }
    ctx.restore();
    renderMinimapFnRef.current();
  }, [shapeKind, color, size, shapeFill, frameShape, frameColor, frameFill, frameOpacity, frameBorderWidth]);

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
  }, [render]);

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
    const ch = supabase
      .channel(`board-${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "draw" }, ({ payload }: { payload: WsEvent }) => {
        if (payload.type === "clear")     { itemsRef.current = []; remotePathsRef.current.clear(); render(); return; }
        if (payload.type === "pdf_clear") { pdfOffscreen.current = null; render(); setPdf(null); return; }
        if (payload.type === "pdf_page")  { loadPdfPage(payload.pdfUrl, "", payload.pdfPage); return; }
        if (payload.type === "viewport")  { applyView(payload.zoom, payload.panX, payload.panY); return; }
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
          render(); return;
        }
        if (payload.type === "path") {
          remotePathsRef.current.delete(payload.item.id);
          itemsRef.current.push(payload.item); render(); return;
        }
        if (payload.type === "update") {
          const idx = itemsRef.current.findIndex(it => it.id === payload.item.id);
          if (idx >= 0) { itemsRef.current[idx] = payload.item; render(); }
          return;
        }
      })
      .subscribe(s => setConnected(s === "SUBSCRIBED"));
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId, render, applyView, loadPdfPage]);

  const send = (p: WsEvent) => channelRef.current?.send({ type: "broadcast", event: "draw", payload: p });
  const bringToMe = () => { const { zoom, panX, panY } = viewRef.current; send({ type: "viewport", zoom, panX, panY }); };

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
      ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
          ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
          ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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

    // Always hit-test: tapping any item selects it regardless of tool
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

    // No item hit — deselect and handle by tool
    setSelectedId(null); setSelectedIds(new Set());

    if (tool === "text") {
      setTextInput({ wx: w.x, wy: w.y }); setTextValue("");
      setTimeout(() => textRef.current?.focus(), 50); return;
    }
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
            ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
    touchDrawPending.current = null;
    if (e.touches.length < 2 && panning.current) {
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
          ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
      ...(pdfPageRef.current !== null && !eid ? { pdfPage: pdfPageRef.current } : {}),
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
        ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
    img.crossOrigin = "anonymous";
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
        const dataUrl = tmp.toDataURL("image/png");
        const w = Math.min(tmp.width / scale, 800);
        const h = Math.round(w * (tmp.height / tmp.width));
        const item: ImageItem = {
          type: "image", id: uid(), url: dataUrl,
          x: cx - w / 2, y: cy - h / 2, w, h,
          ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
      ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
    };
    itemsRef.current.push(item); render();
    send({ type:"path", item }); pushHistory({ type:"add", item });
  };

  const uploadAndAddImage = async (file: File) => {
    setImgUploading(true);
    try {
      const form = new FormData(); form.append("file", file);
      const res  = await fetch("/api/board/image", { method: "POST", body: form });
      if (!res.ok) { const url = URL.createObjectURL(file); addImageToBoard(url); return; }
      const { url } = await res.json();
      addImageToBoard(url);
    } finally { setImgUploading(false); }
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
      ...(pdfPageRef.current !== null ? { pdfPage: pdfPageRef.current } : {}),
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
    if (!mc) return;
    const W = mc.width, H = mc.height;
    const mctx = mc.getContext("2d");
    if (!mctx) return;

    mctx.clearRect(0, 0, W, H);

    const items = itemsRef.current;

    // Bounds: start from viewport, expand to include items
    const { zoom, panX, panY } = viewRef.current;
    const cont = containerRef.current;
    const cw = cont?.clientWidth ?? 800, ch = cont?.clientHeight ?? 600;
    let minX = -panX / zoom, minY = -panY / zoom;
    let maxX = (cw - panX) / zoom, maxY = (ch - panY) / zoom;

    for (const item of items) {
      const b = getItemBounds(item);
      if (!b) continue;
      minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h);
    }

    const pad = Math.max((maxX - minX) * 0.06, 40);
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const bw = maxX - minX, bh = maxY - minY;
    const scale = Math.min(W / bw, H / bh);
    const offX = (W - bw * scale) / 2;
    const offY = (H - bh * scale) / 2;
    minimapMapRef.current = { minX, minY, scale, offX, offY };

    const mx = (x: number) => (x - minX) * scale + offX;
    const my = (y: number) => (y - minY) * scale + offY;

    // Background
    mctx.fillStyle = "#f8f5f0";
    mctx.fillRect(0, 0, W, H);

    // Draw function graphs as sampled curves
    for (const item of items) {
      if (item.type !== "function") continue;
      const fn = parseFormula((item as FunctionItem).formula);
      if (!fn) continue;
      mctx.save();
      mctx.strokeStyle = (item as FunctionItem).color ?? "#4a80f0";
      mctx.lineWidth = 1.5;
      mctx.globalAlpha = 0.7;
      mctx.beginPath();
      let started = false;
      const steps = 120;
      for (let i = 0; i <= steps; i++) {
        const wx = minX + (maxX - minX) * (i / steps);
        const wy = -fn(wx);
        if (!isFinite(wy) || Math.abs(wy) > (maxY - minY) * 10) { started = false; continue; }
        const sx = mx(wx), sy = my(wy);
        if (!started) { mctx.moveTo(sx, sy); started = true; } else { mctx.lineTo(sx, sy); }
      }
      mctx.stroke();
      mctx.restore();
    }

    // Draw items
    mctx.globalAlpha = 0.85;
    for (const item of items) {
      if (item.type === "function") continue;
      const b = getItemBounds(item);
      if (!b) continue;
      const sw = Math.max(b.w * scale, 4), sh = Math.max(b.h * scale, 4);
      if (item.type === "frame") {
        mctx.fillStyle = item.bgColor ?? "#e0e7ff";
        mctx.strokeStyle = item.color ?? "#6366f1";
        mctx.lineWidth = 1.5;
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
        mctx.strokeRect(mx(b.x), my(b.y), sw, sh);
      } else if (item.type === "text") {
        mctx.fillStyle = "#f59e0b";
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
      } else if (item.type === "image") {
        mctx.fillStyle = "#10b981";
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
      } else if (item.type === "video") {
        mctx.fillStyle = "#6366f1";
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
      } else if (item.type === "shape") {
        mctx.fillStyle = item.fill ?? item.color ?? "#94a3b8";
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
      } else if (item.type === "path") {
        // Draw actual path points for better fidelity
        const pts = (item as PathItem).points;
        if (pts.length < 2) {
          mctx.fillStyle = (item as PathItem).color ?? "#1a1a1a";
          mctx.fillRect(mx(b.x), my(b.y), Math.max(sw, 4), Math.max(sh, 4));
        } else {
          mctx.save();
          mctx.strokeStyle = (item as PathItem).color ?? "#1a1a1a";
          mctx.lineWidth = Math.max(1, (item as PathItem).size * scale * 0.5);
          mctx.lineCap = "round"; mctx.lineJoin = "round";
          mctx.beginPath();
          mctx.moveTo(mx(pts[0].x), my(pts[0].y));
          for (let i = 1; i < pts.length; i++) mctx.lineTo(mx(pts[i].x), my(pts[i].y));
          mctx.stroke();
          mctx.restore();
        }
      } else {
        mctx.fillStyle = "#94a3b8";
        mctx.fillRect(mx(b.x), my(b.y), sw, sh);
      }
    }

    // Viewport rect
    const vx1 = -panX / zoom, vy1 = -panY / zoom;
    const vx2 = (cw - panX) / zoom, vy2 = (ch - panY) / zoom;
    mctx.globalAlpha = 1;
    mctx.fillStyle = "rgba(59,130,246,0.10)";
    mctx.fillRect(mx(vx1), my(vy1), (vx2 - vx1) * scale, (vy2 - vy1) * scale);
    mctx.strokeStyle = "#3b82f6";
    mctx.lineWidth = 1.5;
    mctx.strokeRect(mx(vx1), my(vy1), (vx2 - vx1) * scale, (vy2 - vy1) * scale);
  }, [showMinimap]);

  // keep fn ref in sync
  useEffect(() => { renderMinimapFnRef.current = renderMinimap; }, [renderMinimap]);

  // fit all content in view
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
        case "Escape": setPendingSymbol(null); setPendingSymbolPos(null); break;
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

  return (
    <div className="flex flex-1 overflow-hidden select-none" style={{ touchAction: "none" }}>

      {/* Vertical sidebar */}
      <aside className="hidden sm:flex flex-col items-center gap-1 py-2 border-r shrink-0 relative transition-all duration-200"
        style={{ width: sidebarCollapsed ? 0 : 52, overflowX: "visible", overflowY: sidebarCollapsed ? "hidden" : "auto", borderColor:"var(--brown-pale)", background:"white" }}>
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
            <div className="fixed z-[80] rounded-xl border shadow-lg flex flex-col"
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
            <div className="fixed z-50 rounded-xl border shadow-lg p-1.5 w-52"
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
        <div className="flex-1"/>
        {/* More tools at bottom */}
        <div className="w-8 h-px mx-auto mb-1" style={{ background:"var(--brown-pale)" }}/>
        <div className="relative" ref={moreToolsAnchorRef}>
          <SideBtn active={showMoreTools} onClick={()=>{
            const r = moreToolsAnchorRef.current?.getBoundingClientRect();
            if (r) setMoreToolsPos({ top: r.top, left: r.right + 8 });
            setShowMoreTools(v=>!v);
          }} title="Ещё инструменты">
            <span className="text-lg font-bold leading-none">+</span>
          </SideBtn>
          {showMoreTools && moreToolsPos && (
            <div className="fixed z-50 rounded-2xl border shadow-xl overflow-hidden"
              style={{ background:"white", borderColor:"var(--brown-pale)", width:260, top: moreToolsPos.top, left: moreToolsPos.left }}>
              <div className="px-3 py-2 text-xs font-medium border-b" style={{ color:"var(--brown-mid)", borderColor:"var(--brown-pale)" }}>Ещё инструменты</div>
              <div className="p-2 grid grid-cols-3 gap-1.5">
                {/* Symbols */}
                <button onClick={()=>{setShowSymbols(v=>!v);setShowMoreTools(false);}}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <span className="text-xl">∑</span><span className="text-xs">Символы</span>
                </button>
                {/* Dice */}
                <button onClick={()=>{setShowDice(v=>!v);setShowMoreTools(false);}}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <span className="text-xl">🎲</span><span className="text-xs">Кубик</span>
                </button>
                {/* Wheel */}
                <button onClick={()=>{setShowWheel(v=>!v);setShowMoreTools(false);}}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl border hover:opacity-70"
                  style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
                  <span className="text-xl">🎡</span><span className="text-xs">Колесо</span>
                </button>
                {/* Table */}
                {role==="tutor" && (
                  <button onClick={()=>{setShowTablePicker(v=>!v);setShowMoreTools(false);}}
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
                      onChange={e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";setShowMoreTools(false);addVideoToBoard(URL.createObjectURL(f));}}/>
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

          {/* Left: sidebar toggle + tool-specific options, scrolls horizontally */}
          <div className="flex items-center gap-2 px-2 py-1.5 overflow-x-auto flex-1 min-w-0">

          {/* Sidebar toggle */}
          <button onClick={() => setSidebarCollapsed(v => !v)}
            className="shrink-0 p-1.5 rounded-lg border-2 transition-all"
            style={{ borderColor: sidebarCollapsed ? "var(--brown-dark)" : "var(--brown-pale)",
              color: sidebarCollapsed ? "var(--brown-dark)" : "var(--brown-light)" }}
            title={sidebarCollapsed ? "Показать панель инструментов" : "Скрыть панель инструментов"}>
            <ChevronRight size={14} style={{ transform: sidebarCollapsed ? "none" : "rotate(180deg)", transition:"transform 0.2s" }}/>
          </button>
          <div className="w-px h-5 shrink-0" style={{ background:"var(--brown-pale)" }}/>

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
              <button onClick={bringToMe} title="Перенести ученика ко мне" className="p-1.5 rounded-lg border-2"
                style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}>
                <Navigation size={13}/>
              </button>
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
        style={{ background:"#e8e8e8", cursor }}
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
          livePathRef.current = null; liveShapeRef.current = null;
          panning.current = false; eraserActiveRef.current = false;
          touchDrawPending.current = null;
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
                setSelectedId(vi.id); setSelectedIds(new Set());
              }}>
              <div className="w-full h-full overflow-hidden"
                style={{ outline: selected ? "2px solid #4a80f0" : undefined }}>
                <video src={vi.url} controls className="w-full h-full object-contain bg-black"
                  style={{ display:"block" }}/>
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
                      <button onMouseDown={e => e.stopPropagation()}
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
                      <button onMouseDown={e => e.stopPropagation()}
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
                  onTouchEnd={e => e.stopPropagation()}
                  onClick={() => toggleLock(selectedItem.id)}>
                  {locked ? <Unlock size={13} color="white"/> : <Lock size={13} color="white"/>}
                </button>
              )}
              {/* Duplicate + Crop + Color + Layer + Delete buttons — flip below item if near top of canvas */}
              <div className="absolute pointer-events-auto flex items-center gap-1"
                style={{ top: tl.y > 36 ? -28 : sh + 4, right:0, zIndex:36 }}>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
                  onClick={() => { const d=shiftItem({...selectedItem,id:uid()},24,24); itemsRef.current.push(d); send({type:"path",item:d}); pushHistory({type:"add",item:d}); render(); }}
                  className="rounded-lg px-2 py-1 text-xs font-medium border hover:opacity-80"
                  title="Дублировать"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>⧉</button>
                {selectedItem.type === "image" && (
                  <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()} onClick={() => setCropId(selectedItem.id)}
                    className="rounded-lg px-2 py-1 text-xs font-medium border hover:opacity-80"
                    title="Обрезать"
                    style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>✂</button>
                )}
                {/* Layer order buttons */}
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
                  onClick={() => reorderItem(selectedItem.id, "forward")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="Вперёд"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronUp size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
                  onClick={() => reorderItem(selectedItem.id, "backward")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="Назад"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronDown size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
                  onClick={() => reorderItem(selectedItem.id, "front")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="На передний план"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronsUp size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
                  onClick={() => reorderItem(selectedItem.id, "back")}
                  className="rounded-lg px-1.5 py-1 text-xs font-medium border hover:opacity-80 flex items-center justify-center"
                  title="На задний план"
                  style={{ background:"white", borderColor:"var(--brown-pale)", color:"var(--brown-dark)", minHeight:28 }}>
                  <ChevronsDown size={14}/>
                </button>
                <button onMouseDown={e=>e.stopPropagation()} onTouchStart={e=>e.stopPropagation()} onTouchEnd={e=>e.stopPropagation()}
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
                  onTouchEnd={e => e.stopPropagation()}
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
              {/* Text color panel — below the selection */}
              {selectedItem.type === "text" && !locked && (
                <div className="absolute pointer-events-auto flex items-center gap-1 px-2 py-1 rounded-xl border shadow-md"
                  style={{ top: sh + 6, left: 0, background:"white", borderColor:"var(--brown-pale)", zIndex:35, whiteSpace:"nowrap" }}
                  onMouseDown={e => e.stopPropagation()}
                  onTouchStart={e => e.stopPropagation()}
                  onTouchEnd={e => e.stopPropagation()}>
                  {(["#1a1a1a","#e05030","#4a80f0","#2a9d5c","#e0a020","#9b59b6","#ffffff"] as const).map(c => (
                    <button key={c}
                      onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()} onTouchEnd={e => e.stopPropagation()}
                      onClick={() => updateBoardItem({...selectedItem as TextItem, color: c})}
                      className="w-5 h-5 rounded-full shrink-0 border-2"
                      style={{ background: c, borderColor: (selectedItem as TextItem).color === c ? "#4a80f0" : "var(--brown-pale)" }}/>
                  ))}
                  <label className="relative w-5 h-5 rounded-full border-2 cursor-pointer overflow-hidden shrink-0"
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
              {/* Frame properties panel */}
              {selectedItem.type === "frame" && !locked && (
                <div className="absolute pointer-events-auto flex items-center gap-1.5 px-2 py-1 rounded-xl shadow-lg border"
                  style={{ top:-44, left:"50%", transform:"translateX(-50%)", background:"white",
                    borderColor:"var(--brown-pale)", whiteSpace:"nowrap", zIndex:35 }}
                  onMouseDown={e => e.stopPropagation()}>
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
                      position:"absolute", bottom:0, left:0, right:0,
                      background:"white", borderRadius:"20px 20px 0 0",
                      borderTop:"2px solid #e8ddd2",
                      boxShadow:"0 -4px 24px rgba(0,0,0,0.15)",
                    }} onClick={e => e.stopPropagation()}>
                      {/* Controls */}
                      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"10px 12px", borderBottom:"1px solid #e8ddd2", overflowX:"auto", touchAction:"pan-x" }}>
                        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setFontSize(s=>Math.max(8,s-2))}
                          style={{ minWidth:36, height:36, borderRadius:8, border:"1.5px solid #e8ddd2", fontSize:13, fontWeight:"bold", color:"#3A2117", background:"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>A−</button>
                        <span style={{ fontSize:13, color:"#3A2117", width:30, textAlign:"center", flexShrink:0 }}>{fontSize}</span>
                        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setFontSize(s=>Math.min(200,s+2))}
                          style={{ minWidth:36, height:36, borderRadius:8, border:"1.5px solid #e8ddd2", fontSize:13, fontWeight:"bold", color:"#3A2117", background:"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>A+</button>
                        <div style={{ width:1, height:24, background:"#e8ddd2", flexShrink:0 }}/>
                        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setBold(b=>!b)}
                          style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${bold?"#4a80f0":"#e8ddd2"}`, fontWeight:"bold", fontSize:15, color:"#3A2117", background:bold?"#eef2ff":"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>B</button>
                        <button onPointerDown={e=>e.preventDefault()} onClick={()=>setItalic(i=>!i)}
                          style={{ width:36, height:36, borderRadius:8, border:`1.5px solid ${italic?"#4a80f0":"#e8ddd2"}`, fontStyle:"italic", fontFamily:"Georgia,serif", fontSize:15, color:"#3A2117", background:italic?"#eef2ff":"white", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>I</button>
                        <label style={{ position:"relative", width:36, height:36, borderRadius:8, border:"1.5px solid #e8ddd2", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, gap:2 }}>
                          <span style={{ fontWeight:"bold", fontSize:14, color, lineHeight:"1" }}>A</span>
                          <div style={{ width:20, height:3, borderRadius:2, background:color }}/>
                          <input type="color" value={color} onChange={e=>setColor(e.target.value)} style={{ position:"absolute", opacity:0, inset:0, cursor:"pointer" }}/>
                        </label>
                        <div style={{ flex:1 }}/>
                        <button onPointerDown={e=>e.preventDefault()} onClick={cancel}
                          style={{ height:36, padding:"0 12px", borderRadius:10, border:"1.5px solid #e8ddd2", fontSize:13, color:"#3A2117", background:"white", flexShrink:0 }}>Отмена</button>
                        <button onPointerDown={e=>e.preventDefault()} onClick={commitText}
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
                            fontSize: Math.min(fontSize, 28)+"px",
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
                      const onUp=()=>{window.removeEventListener("mousemove",onMove);window.removeEventListener("mouseup",onUp);};
                      window.addEventListener("mousemove",onMove); window.addEventListener("mouseup",onUp);
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
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.4)" }}
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
          <div className="fixed inset-0 z-[160] flex items-center justify-center p-4" style={{ background:"rgba(0,0,0,0.4)" }}
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
            style={{ background:"rgba(0,0,0,0.2)" }}
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

        {/* Dice panel */}
        {showDice && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center pt-16 px-4"
            style={{ background:"rgba(0,0,0,0.2)" }}
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
            style={{ background:"rgba(0,0,0,0.2)" }}
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

        {/* Wheel panel */}
        {showWheel && (
          <div className="fixed inset-0 z-[250] flex items-start justify-center pt-16 px-4"
            style={{ background:"rgba(0,0,0,0.2)" }}
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
        <div className="absolute bottom-3 right-3 z-[60] flex flex-col items-end gap-1.5">
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
                }}/>
            </div>
          )}
          {/* Toggle button — always visible */}
          <button onClick={() => { setShowMinimap(v => !v); setTimeout(() => render(), 0); }}
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

      {/* Mobile toolbar */}
      <div className="flex sm:hidden flex-col border-t shrink-0" style={{ borderColor:"var(--brown-pale)", background:"white" }}
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
            <button onClick={bringToMe} className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg border-2 font-medium shrink-0"
              style={{ borderColor:"var(--brown-dark)", color:"var(--brown-dark)" }}>
              <Navigation size={12}/> Ко мне
            </button>
          )}
          <button onClick={undo} disabled={!canUndo} className="p-2 rounded-lg border disabled:opacity-25 shrink-0" style={{ borderColor:"var(--brown-pale)" }}><Undo2 size={16} style={{ color:"var(--brown-dark)" }}/></button>
          <button onClick={redo} disabled={!canRedo} className="p-2 rounded-lg border disabled:opacity-25 shrink-0" style={{ borderColor:"var(--brown-pale)" }}><Redo2 size={16} style={{ color:"var(--brown-dark)" }}/></button>
          <button onClick={() => applyView(1,0,0)} className="p-2 rounded-lg border shrink-0" style={{ borderColor:"var(--brown-pale)" }}><Maximize2 size={16} style={{ color:"var(--brown-dark)" }}/></button>
        </div>
        {/* More tools panel */}
        {showMoreTools && (
          <div className="flex items-center gap-1.5 px-2 py-2 border-b overflow-x-auto" style={{ borderColor:"var(--brown-pale)", touchAction:"pan-x" }}>
            <button onClick={()=>{setShowSymbols(v=>!v);setShowMoreTools(false);}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-lg">∑</span><span className="text-xs">Символы</span>
            </button>
            <button onClick={()=>{setShowDice(v=>!v);setShowMoreTools(false);}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-lg">🎲</span><span className="text-xs">Кубик</span>
            </button>
            <button onClick={()=>{setShowWheel(v=>!v);setShowMoreTools(false);}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-lg">🎡</span><span className="text-xs">Колесо</span>
            </button>
            <button onClick={()=>{setShowFnPanel(v=>!v);setShowMoreTools(false);}}
              className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border shrink-0"
              style={{ borderColor:"var(--brown-pale)", color:"var(--brown-dark)" }}>
              <span className="text-sm font-bold font-mono leading-none mb-0.5">f(x)</span><span className="text-xs">График</span>
            </button>
            {role==="tutor" && (
              <button onClick={()=>{setShowTablePicker(v=>!v);setShowMoreTools(false);}}
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
                  onChange={e=>{const f=e.target.files?.[0];if(!f)return;e.target.value="";setShowMoreTools(false);addVideoToBoard(URL.createObjectURL(f));}}/>
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
  return (
    <div className="relative group">
      <button onClick={onClick} aria-label={title}
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{ background: active?"var(--brown-pale)":"transparent",
          color: active?"var(--brown-dark)":"var(--brown-light)",
          border: active?"2px solid var(--brown-dark)":"2px solid transparent" }}>
        {children}
      </button>
      {/* Custom tooltip — only on pointer devices, hidden on touch */}
      <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-[300]
        pointer-events-none select-none
        opacity-0 group-hover:opacity-100 transition-opacity duration-100
        [@media(hover:hover)]:block hidden"
        style={{ filter:"drop-shadow(0 2px 6px rgba(0,0,0,.18))" }}>
        {/* Arrow */}
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
