import { NextRequest, NextResponse } from "next/server";
import { consumeAiRequest } from "@/lib/aiUsage";
import { gigachatComplete } from "@/lib/gigachat";

const systemPrompts: Record<string, string> = {
  reference: `Ты помощник репетитора. Выполняй точно то, о чём просят — не добавляй лишнего.
Используй Markdown для форматирования:
- ## Заголовки для разделов
- **жирный** для ключевых терминов
- *курсив* для примеров
- Таблицы в формате | Столбец | Столбец | (с разделительной строкой |---|---|)
- - Списки для перечислений
- 1. Нумерованные списки для шагов

Если просят таблицу — пиши только таблицу. Если просят объяснение — только объяснение.
Без вступлений «конечно!», «вот», «отлично» — сразу к делу.
Можно любой предмет: языки, математика, физика, история, биология и т.д.`,

  vocabulary_example: `Ты помощник репетитора по языкам. Придумай 2–3 живых примера предложений со словом или фразой.
Пиши коротко, по одному предложению на строку. Только примеры, без вступлений.`,

  vocabulary_hint: `Ты помощник репетитора. Дай краткую подсказку или мнемонику, которая поможет запомнить слово.
Одна-две фразы максимум. Только подсказку, без вступлений.`,

  vocabulary_set: `Ты помощник репетитора. Создай набор словарных карточек по запросу пользователя.
Верни ТОЛЬКО валидный JSON-массив без markdown и без объяснений:
[{"word":"...","translation":"...","example":"..."}]

Правила:
- word: слово или фраза на изучаемом языке
- translation: перевод на русский
- example: короткое живое предложение с этим словом (на языке оригинала)
- 6–12 карточек если не указано количество
- Только JSON, никакого текста вокруг`,

  trainer_cards: `Ты помощник репетитора. Создай набор учебных карточек для тренажёра по описанию пользователя.
Верни ТОЛЬКО валидный JSON-массив без markdown и без объяснений.

Типы карточек:
- flashcard: вопрос или термин (front) → ответ или определение (back). options: []
- match: левая часть пары (front) → правая часть (back). options: []. Добавь 5–8 пар для одной темы.
- definition: термин (front) → правильное определение (back) + три неверных варианта в options.

Формат:
[{"type":"flashcard","front":"...","back":"...","options":[]},
 {"type":"match","front":"...","back":"...","options":[]},
 {"type":"definition","front":"...","back":"...","options":["неверный1","неверный2","неверный3"]}]

Правила:
- 6–12 карточек если не указано иное
- Если пользователь указал конкретный тип — создай только его
- front и back — короткие и ёмкие, без лишних слов
- Для definition: options — строго 3 неверных варианта, правдоподобных но отличных от правильного
- Только JSON, никакого текста вокруг`,
};

export async function POST(req: NextRequest) {
  const { prompt, mode } = await req.json();
  if (!prompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });

  const usage = await consumeAiRequest();
  if (!usage.ok) return NextResponse.json({ error: usage.error }, { status: 429 });

  const system = systemPrompts[mode] ?? systemPrompts.reference;
  const maxTokens = mode === "trainer_cards" ? 1800 : mode === "vocabulary_set" ? 1000 : mode === "reference" ? 1000 : 400;

  try {
    const text = await gigachatComplete(
      [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      { model: "GigaChat-Pro", maxTokens, temperature: 0.6 }
    );
    return NextResponse.json({ text, remaining: usage.remaining });
  } catch (e) {
    console.error("[ai]", e);
    return NextResponse.json({ error: "AI временно недоступен. Попробуйте позже." }, { status: 503 });
  }
}
