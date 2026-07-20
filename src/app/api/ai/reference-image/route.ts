import { NextRequest, NextResponse } from "next/server";
import { consumeAiRequest } from "@/lib/aiUsage";
import { gigachatComplete } from "@/lib/gigachat";

const SYSTEM = `Ты помощник репетитора. Тебе показывают скриншот учебного материала — страницу учебника, конспект, фото с доски, таблицу и т.д.
Выполни точно то, о чём просит репетитор: адаптируй, перепиши, структурируй или оформи материал из изображения.

Используй Markdown для форматирования:
- ## Заголовки для разделов
- **жирный** для ключевых терминов
- *курсив* для примеров
- Таблицы: | Столбец | Столбец | (с разделительной строкой |---|---|)
- - Списки, 1. нумерованные списки

Без вступлений «конечно!», «вот», «отлично» — сразу результат.
Если на скрине текст на другом языке — переводи на русский (если не просят иначе).`;

export async function POST(req: NextRequest) {
  const usage = await consumeAiRequest();
  if (!usage.ok) return NextResponse.json({ error: usage.error }, { status: 429 });

  const form = await req.formData();
  const file   = form.get("image") as File | null;
  const prompt = (form.get("prompt") as string | null)?.trim();

  if (!file) return NextResponse.json({ error: "Нет изображения" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mime   = file.type || "image/jpeg";

  const userText = prompt
    ? prompt
    : "Распознай и структурируй учебный материал с этого скриншота. Оформи в виде удобной шпаргалки.";

  try {
    const text = await gigachatComplete(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            { type: "text", text: userText },
          ],
        },
      ],
      { model: "GigaChat-Pro", maxTokens: 1500, temperature: 0.4 }
    );
    return NextResponse.json({ text, remaining: usage.remaining });
  } catch (e) {
    console.error("[ai/reference-image]", e);
    return NextResponse.json({ error: "AI временно недоступен. Попробуйте позже." }, { status: 503 });
  }
}
