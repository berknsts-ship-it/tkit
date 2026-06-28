import { NextRequest, NextResponse } from "next/server";

const GROQ_API = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM = `You are an educational whiteboard layout assistant for a tutoring platform. Analyze screenshots of educational materials and create structured interactive whiteboard layouts.

Return ONLY a valid JSON array. No explanation, no markdown, no code blocks — just the raw JSON array starting with [ and ending with ].

Available item types with EXACT required fields:

Type "frame" (section container / answer box):
{ "type": "frame", "x": number, "y": number, "w": number, "h": number, "shape": "rect", "title": "...", "color": "#hex", "bgColor": "#hex", "textColor": "#hex", "fontSize": 14, "borderWidth": 2 }

Type "text":
{ "type": "text", "x": number, "y": number, "text": "...", "font": "Arial, sans-serif", "color": "#hex", "fontSize": number, "bold": boolean, "italic": false, "align": "left" }

Coordinate system:
- Start at x: 20, y: 20. Total width: 900px max.
- Vertical gap between items: 15px minimum.

Color scheme:
- Task header: color "#4a80f0", bgColor "#dce8ff", textColor "#1a3a8a"
- Answer/blank box: color "#bbb", bgColor "#f5f5f5", textColor "#777"
- Important: color "#e05030", bgColor "#fff0ee", textColor "#a03020"
- Neutral text: color "#333"

Layout to create:
1. Header frame (w:860, h:60) with the exercise title at the top
2. For each task/exercise visible in the screenshot:
   - A labeled frame header (w:860, h:50, task header colors) with the task number/type as title
   - Text items with the task content (fontSize 17, positioned 12px inside the frame below)
   - For each place where a student should write an answer: an answer frame (w:860, h:65, answer box colors, title "___")
3. All text extracted faithfully from the screenshot

Return the JSON array immediately.`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;
  if (!file) return NextResponse.json({ error: "No image" }, { status: 400 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/jpeg";

  const res = await fetch(GROQ_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.2-90b-vision-preview",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64}` },
            },
            {
              type: "text",
              text: "Analyze this educational screenshot and create an interactive whiteboard layout. Return ONLY the JSON array.",
            },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: res.status });
  }

  const data = await res.json();
  const raw = (data.choices?.[0]?.message?.content ?? "").trim();

  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) return NextResponse.json({ error: "No JSON in response", raw }, { status: 500 });

  let items;
  try {
    items = JSON.parse(match[0]);
  } catch {
    return NextResponse.json({ error: "Invalid JSON", raw }, { status: 500 });
  }

  if (!Array.isArray(items)) return NextResponse.json({ error: "Not an array", raw }, { status: 500 });

  return NextResponse.json({ items });
}
