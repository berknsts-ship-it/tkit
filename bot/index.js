#!/usr/bin/env node
// T-Kit Telegram Bot — long polling, no external dependencies
// Required env vars:
//   TELEGRAM_BOT_TOKEN
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
//   NEXT_PUBLIC_SITE_URL (optional, default https://t-kit.ru)

const https = require("https");
const http  = require("http");

const BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const SB_URL      = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const SB_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL    = (process.env.NEXT_PUBLIC_SITE_URL || "https://t-kit.ru").replace(/\/$/, "");

if (!BOT_TOKEN) { console.error("[bot] TELEGRAM_BOT_TOKEN not set"); process.exit(1); }
if (!SB_URL || !SB_KEY) { console.error("[bot] Supabase env vars not set"); process.exit(1); }

// ─── HTTP helper ────────────────────────────────────────────────────────────

function request(url, { method = "GET", headers = {}, body, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const buf = body ? Buffer.from(typeof body === "string" ? body : JSON.stringify(body)) : null;
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(
      { hostname: u.hostname, port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search, method,
        headers: { "Content-Type": "application/json", ...(buf ? { "Content-Length": buf.length } : {}), ...headers } },
      (res) => {
        const chunks = [];
        res.on("data", c => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          try { resolve({ status: res.statusCode, body: JSON.parse(text) }); }
          catch { resolve({ status: res.statusCode, body: text }); }
        });
      }
    );
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    if (buf) req.write(buf);
    req.end();
  });
}

// ─── Telegram API ─────────────────────────────────────────────────────────

async function tg(method, params = {}) {
  const { body } = await request(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST", body: params, timeoutMs: 40000,
  });
  return body;
}

async function sendMessage(chatId, text, inlineUrl) {
  const params = { chat_id: chatId, text, parse_mode: "HTML" };
  if (inlineUrl) params.reply_markup = { inline_keyboard: [[{ text: "Открыть →", url: inlineUrl }]] };
  return tg("sendMessage", params).catch(e => console.error("[bot] sendMessage error:", e.message));
}

// ─── Supabase REST ────────────────────────────────────────────────────────

function sb(table, { method = "GET", query = "", body, prefer = "return=minimal" } = {}) {
  return request(`${SB_URL}/rest/v1/${table}${query}`, {
    method, body,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      Prefer: prefer,
    },
  });
}

// ─── /start handler ───────────────────────────────────────────────────────

async function handleStart(chatId, code, fromFirst) {
  if (!code) {
    await sendMessage(chatId, "Привет! Используй кнопку «Подключить Telegram» в настройках T-Kit.");
    return;
  }

  const { body: codes } = await sb("telegram_link_codes", {
    query: `?code=eq.${encodeURIComponent(code)}&select=tutor_id,student_id,expires_at`,
    prefer: "return=representation",
  });

  if (!Array.isArray(codes) || !codes[0]) {
    await sendMessage(chatId, "❌ Код не найден. Сгенерируй новую ссылку в настройках.");
    return;
  }
  const lc = codes[0];
  if (new Date(lc.expires_at) < new Date()) {
    await sendMessage(chatId, "❌ Ссылка истекла (15 мин). Сгенерируй новую в настройках.");
    return;
  }

  let name = fromFirst || "Пользователь";

  if (lc.tutor_id) {
    const { body: rows } = await sb("tutors", { query: `?id=eq.${lc.tutor_id}&select=name`, prefer: "return=representation" });
    if (Array.isArray(rows) && rows[0]?.name) name = rows[0].name;
    await sb("tutors", { method: "PATCH", query: `?id=eq.${lc.tutor_id}`, body: { telegram_chat_id: String(chatId) } });
    console.log(`[bot] tutor ${lc.tutor_id} linked chat ${chatId}`);
  } else if (lc.student_id) {
    const { body: rows } = await sb("students", { query: `?id=eq.${lc.student_id}&select=name`, prefer: "return=representation" });
    if (Array.isArray(rows) && rows[0]?.name) name = rows[0].name;
    await sb("students", { method: "PATCH", query: `?id=eq.${lc.student_id}`, body: { telegram_chat_id: String(chatId) } });
    console.log(`[bot] student ${lc.student_id} linked chat ${chatId}`);
  }

  // Consume the code
  await sb("telegram_link_codes", { method: "DELETE", query: `?code=eq.${encodeURIComponent(code)}` });

  await sendMessage(
    chatId,
    `✅ Привет, ${name}!\n\nТелеграм подключён. Уведомления от T-Kit будут приходить сюда.`,
    `${SITE_URL}/tutor/settings`
  );
}

// ─── Long polling ─────────────────────────────────────────────────────────

let offset = 0;

async function poll() {
  try {
    const res = await tg("getUpdates", { offset, timeout: 30, allowed_updates: ["message"] });
    if (!res.ok || !Array.isArray(res.result)) {
      if (res.error_code) console.error("[bot] getUpdates error:", res.description);
      await sleep(5000);
      return poll();
    }

    for (const upd of res.result) {
      offset = upd.update_id + 1;
      const msg = upd.message;
      if (!msg?.text) continue;

      const chatId = msg.chat.id;
      const text   = msg.text.trim();
      const name   = msg.from?.first_name || msg.from?.username || "";

      if (text.startsWith("/start")) {
        const parts = text.split(/\s+/);
        const code  = parts[1] || "";
        handleStart(chatId, code, name).catch(e => console.error("[bot] handleStart error:", e));
      }
    }
  } catch (e) {
    console.error("[bot] poll error:", e.message);
    await sleep(5000);
  }
  setImmediate(poll);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ─── Start ────────────────────────────────────────────────────────────────

// Clear webhook so polling works
tg("deleteWebhook").then(() => {
  console.log("[bot] started, polling...");
  poll();
}).catch(e => {
  console.error("[bot] deleteWebhook failed:", e.message);
  poll();
});

process.on("uncaughtException", e => console.error("[bot] uncaughtException:", e));
process.on("unhandledRejection", e => console.error("[bot] unhandledRejection:", e));
