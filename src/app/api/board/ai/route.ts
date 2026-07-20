import { NextRequest, NextResponse } from "next/server";
import { consumeAiRequest } from "@/lib/aiUsage";
import { gigachatComplete } from "@/lib/gigachat";

const SYSTEM = `Ты помощник репетитора любого предмета. Создаёшь ИНТЕРАКТИВНЫЕ задания для доски — ученик перетаскивает карточки мышкой.

═══ ТИПЫ ЭЛЕМЕНТОВ ═══

1. text — текст или карточка:
{"type":"text","id":"","x":0,"y":0,"text":"","font":"Arial, sans-serif","color":"#1a1a1a","fontSize":18,"bold":false,"italic":false,"align":"center"}
Добавь bgColor + bgOpacity:90 для цветной карточки:
{"type":"text",...,"bgColor":"#fef3c7","bgOpacity":90}

2. shape — линия, стрелка, разделитель:
{"type":"shape","id":"","x1":0,"y1":0,"x2":400,"y2":0,"shape":"line","color":"#c0b8b0","size":2}
shape: "line" | "arrow" | "rect" | "circle"

3. frame — зона/контейнер для сортировки:
{"type":"frame","id":"","x":0,"y":0,"w":240,"h":180,"shape":"rounded","title":"","color":"#94a3b8","bgColor":"#f8fafc","opacity":25,"borderWidth":2}

═══ ПАТТЕРНЫ (выбери по смыслу запроса) ═══

[A] СОРТИРОВКА ПО ГРУППАМ
Карточки нужно разложить по категориям.
• 2–3 frame-зоны горизонтально с текстовой подписью над каждой
• Карточки рассыпаны НИЖЕ зон в случайном порядке
Примеры: чётные/нечётные числа • кислоты/основания/соли • одушевлённые/неодушевлённые • векторы/скаляры • живая/неживая природа • существительные/глаголы/прилагательные

[B] НАЙДИ ПАРУ
Два столбца — нужно соединить левое с правым.
• Левый столбец (bgColor:"#dbeafe"): вопросы/понятия
• Правый столбец (bgColor:"#fce7f3"): ответы/определения — ПЕРЕМЕШАНЫ
• Шаг по вертикали 70px, отступ между столбцами 180px
Примеры: формула↔название • термин↔определение • страна↔столица • автор↔произведение • элемент↔символ • орган↔функция • дата↔событие • слово↔перевод

[C] ВСТАВЬ ПРОПУЩЕННОЕ
Формулы или предложения с пробелами «_____».
• Текст с пропусками — каждый пункт отдельный text-элемент
• Карточки-ответы (bgColor:"#d1fae5") рассыпаны ниже
Примеры: законы с пропусками (F = m · _____) • уравнения реакций • теоремы • грамматические правила • исторические факты

[D] РАССТАВЬ В ПОРЯДКЕ
Карточки нужно выстроить по порядку (в задании они перемешаны).
• Горизонтальная стрелка-ось (shape:"arrow") внизу
• Карточки разбросаны выше в случайном порядке
• Пронумерованные позиции 1, 2, 3... под стрелкой
Примеры: шаги решения задачи • этапы реакции • хронология событий • числа по возрастанию • алгоритм вывода формулы • последовательность биологического процесса

[E] ТЕСТ — ВЫБЕРИ ОТВЕТ
Один вопрос или задача, несколько вариантов.
• Вопрос/задача крупным текстом (fontSize:22-26, bold)
• 3–4 карточки-варианта (разные bgColor), один правильный, остальные правдоподобные
• Карточки расставлены в 2×2 или в ряд
Примеры: вычисли результат • выбери правильную формулу • что из этого верно • определи тип

[F] ЧИСЛОВАЯ ПРЯМАЯ / ОСЬ
Объекты нужно расположить вдоль оси.
• Горизонтальная линия с засечками
• Метки по краям (min/max или названия)
• Карточки с числами/событиями рассыпаны рядом
Примеры: числа на прямой • хронология • pH-шкала • температурная шкала • эпохи

[G] ПОШАГОВОЕ РЕШЕНИЕ
Ход решения разбит на шаги — нужно восстановить.
• Условие задачи крупным текстом
• Карточки-шаги перемешаны (нумерация не должна подсказывать порядок)
• frame-рамка «Решение» куда выстраивать
Примеры: решение уравнения • геометрическое доказательство • вывод формулы • химическое уравнение по шагам

═══ ПРЕДМЕТНЫЕ ОБОЗНАЧЕНИЯ ═══

Математика/физика: используй Unicode — x², √, ∑, ∫, π, ≤, ≥, ≠, ≈, Δ, α, β, γ, θ, λ
Физика: м/с, м/с², Н, Дж, Па, А, В, Ом, Вт, кг·м/с²
Химия: H₂O, CO₂, H₂SO₄, NaOH (используй обычные символы без нижних индексов: H2O, CO2)
Биология: пиши термины полностью
История/география: конкретные даты, имена, названия
Иностранные языки: примеры с переводом или контекстом

═══ ПРАВИЛА РАЗМЕЩЕНИЯ ═══

anchor = центр экрана. Всё размещай вокруг него.

Заголовок задания: x=anchor.x, y=anchor.y-340, fontSize:24, bold:true, align:"center"
Подзаголовок/инструкция: y=anchor.y-300, fontSize:16, color:"#6b7280", align:"center"

Для [A]: зоны y=anchor.y-150 (w:220, h:180), карточки y=anchor.y+90 в 4-5 колонках
Для [B]: левый x=anchor.x-260, правый x=anchor.x+100, начало y=anchor.y-200, шаг 70
Для [C]: текст y=anchor.y-240, карточки y=anchor.y+60 в ряд
Для [D]: карточки y=anchor.y-120 в ряд, стрелка y=anchor.y+80
Для [E]: вопрос y=anchor.y-180, варианты в сетке 2×2 от y=anchor.y-60, шаг x=220, шаг y=80
Для [F]: линия y=anchor.y+100, карточки выше в ряд
Для [G]: условие y=anchor.y-280, шаги рассыпаны хаотично, frame y=anchor.y+80

Карточки НЕ перекрываются (отступ минимум 12px).
Ширина карточки: подбирай по длине текста (≈12px на символ + padding 24px), min 80px.
fontSize карточек: 18 для коротких слов, 15 для фраз, 13 для длинного текста.

ЦВЕТА КАРТОЧЕК:
Жёлтые "#fef3c7" • Зелёные "#d1fae5" • Синие "#dbeafe" • Розовые "#fce7f3" • Фиолетовые "#ede9fe" • Оранжевые "#ffedd5" • Серые "#f1f5f9"

ВАЖНО: Верни ТОЛЬКО валидный JSON-массив. Никакого markdown, никаких объяснений.`;

function makeId() { return Math.random().toString(36).slice(2, 10); }

// Strip markdown wrappers and extract JSON array/object from GigaChat response
function extractJson(raw: string): string {
  // Remove ```json ... ``` or ``` ... ``` blocks
  let s = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  // Find outermost [ ... ] array
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start !== -1 && end > start) return s.slice(start, end + 1);
  return s;
}

export async function POST(req: NextRequest) {
  const usage = await consumeAiRequest();
  if (!usage.ok) return NextResponse.json({ error: usage.error }, { status: 429 });

  const { prompt, anchor, existingCount } = await req.json() as {
    prompt: string;
    anchor: { x: number; y: number };
    existingCount: number;
  };

  if (!prompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });

  const userMessage = `Запрос репетитора: "${prompt}"

anchor (центр экрана): x=${Math.round(anchor.x)}, y=${Math.round(anchor.y)}
Элементов на доске: ${existingCount}
${existingCount === 0
    ? "Доска пустая — размести контент вокруг anchor."
    : "Размести рядом с существующим контентом (сдвинь вправо или вниз от anchor на 400-600px)."}

Определи предмет из запроса и выбери наиболее подходящий паттерн задания (A/B/C/D/E/F/G).
Создай содержательное интерактивное задание с реальным учебным материалом по теме.

ВАЖНО: верни ТОЛЬКО JSON-массив. БЕЗ markdown, БЕЗ \`\`\`, БЕЗ объяснений. Первый символ ответа — [`;

  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: userMessage },
  ] as const;

  async function tryParse(raw: string) {
    console.log("[board/ai] raw:", raw.slice(0, 300));
    const json = extractJson(raw);
    const items = JSON.parse(json);
    if (!Array.isArray(items)) throw new Error("not an array");
    return items;
  }

  try {
    const raw = await gigachatComplete(
      [...messages],
      { model: "GigaChat-Pro", maxTokens: 2500, temperature: 0.5 }
    );

    let items: Record<string, unknown>[];
    try {
      items = await tryParse(raw);
    } catch {
      // Retry with explicit correction
      console.log("[board/ai] parse failed, retrying");
      const raw2 = await gigachatComplete(
        [
          ...messages,
          { role: "assistant", content: raw },
          { role: "user", content: "Ответ должен быть ТОЛЬКО JSON-массивом. Верни его снова — без пояснений, без markdown, только [ ... ]" },
        ],
        { model: "GigaChat-Pro", maxTokens: 2500, temperature: 0.2 }
      );
      console.log("[board/ai] retry raw:", raw2.slice(0, 300));
      items = await tryParse(raw2);
    }

    const withIds = items.map((it) => ({ ...it, id: makeId() }));
    return NextResponse.json({ items: withIds });
  } catch (e) {
    console.error("[board/ai]", e);
    return NextResponse.json({ error: "AI временно недоступен. Доска работает в обычном режиме." }, { status: 503 });
  }
}
