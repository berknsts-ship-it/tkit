import { NextRequest, NextResponse } from "next/server";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

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
};

export async function POST(req: NextRequest) {
  const { prompt, mode } = await req.json();
  if (!prompt) return NextResponse.json({ error: "No prompt" }, { status: 400 });

  const system = systemPrompts[mode] ?? systemPrompts.reference;
  const maxTokens = mode === "vocabulary_set" ? 1200 : mode === "reference" ? 1200 : 400;

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
      max_tokens: maxTokens,
      temperature: 0.6,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  return NextResponse.json({ text });
}
