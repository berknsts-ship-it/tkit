export async function sendTelegram(chatId: string, text: string, actionUrl?: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;

  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: "HTML" };
  if (actionUrl) {
    body.reply_markup = { inline_keyboard: [[{ text: "Открыть →", url: actionUrl }]] };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[telegram]", res.status, err.slice(0, 200));
    }
  } catch (e) {
    console.error("[telegram] fetch error:", e);
  }
}
