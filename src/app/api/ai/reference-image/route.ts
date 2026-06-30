import { NextRequest, NextResponse } from "next/server";
import { consumeAiRequest } from "@/lib/aiUsage";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

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

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            { type: "text", text: userText },
          ],
        },
      ],
      max_tokens: 1500,
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: "" } }));
    const msg = (err?.error?.message as string) ?? "";
    const m = msg.match(/Please try again in (\d+(?:\.\d+)?)s/);
    const friendly = m
      ? `Слишком много запросов. Подождите ${Math.ceil(parseFloat(m[1]))} сек. и попробуйте снова.`
      : "Ошибка ИИ. Попробуйте ещё раз.";
    return NextResponse.json({ error: friendly }, { status: res.status });
  }

  const data = await res.json();
  const text = (data.choices?.[0]?.message?.content ?? "").trim();
  return NextResponse.json({ text, remaining: usage.remaining });
}
