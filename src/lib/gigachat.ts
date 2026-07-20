import https from "node:https";
import fs from "node:fs";
import path from "node:path";

// Russian Ministry of Digital Development CA cert
// Download: curl -o certs/russian_trusted_root_ca.cer https://gu-st.ru/content/Other/doc/russian_trusted_root_ca_2022.cer
let _ca: Buffer | undefined;
function getCA(): Buffer | undefined {
  if (_ca !== undefined) return _ca.length ? _ca : undefined;
  try {
    _ca = fs.readFileSync(path.join(process.cwd(), "certs", "russian_trusted_root_ca.cer"));
  } catch {
    _ca = Buffer.alloc(0);
  }
  return _ca.length ? _ca : undefined;
}

type JsonResponse = { ok: boolean; status: number; json<T = unknown>(): Promise<T> };

function httpsPost(url: string, headers: Record<string, string>, body: string | Buffer): Promise<JsonResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const bodyBuf = typeof body === "string" ? Buffer.from(body, "utf8") : body;
    const ca = getCA();

    const req = https.request(
      {
        hostname: u.hostname,
        port: Number(u.port) || 443,
        path: u.pathname + u.search,
        method: "POST",
        headers: { ...headers, "Content-Length": bodyBuf.length },
        ...(ca ? { ca } : {}),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: <T>() => Promise.resolve(JSON.parse(text) as T),
          });
        });
      }
    );
    req.on("error", reject);
    req.write(bodyBuf);
    req.end();
  });
}

// --- OAuth token cache (per-process, 25 min TTL) ---
let _token: string | null = null;
let _tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token;

  const authKey = process.env.GIGACHAT_AUTH_KEY;
  if (!authKey) throw new Error("GIGACHAT_AUTH_KEY не задан");

  const res = await httpsPost(
    "https://ngw.devices.sberbank.ru:9443/api/v2/oauth",
    {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": `Basic ${authKey}`,
      "RqUID": crypto.randomUUID(),
    },
    "scope=GIGACHAT_API_PERS"
  );

  if (!res.ok) throw new Error(`GigaChat OAuth: HTTP ${res.status}`);

  const data = await res.json<{ access_token: string; expires_at: number }>();
  _token = data.access_token;
  _tokenExpiry = Date.now() + 25 * 60 * 1000; // 25 min regardless of expires_at
  return _token;
}

// --- Chat completions ---

type GigaMessage =
  | { role: string; content: string }
  | { role: string; content: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> };

export async function gigachatComplete(
  messages: GigaMessage[],
  opts: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const token = await getAccessToken();
  const { model = "GigaChat-Pro", maxTokens = 2500, temperature = 0.5 } = opts;

  const res = await httpsPost(
    "https://gigachat.devices.sberbank.ru/api/v1/chat/completions",
    {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    JSON.stringify({ model, messages, max_tokens: maxTokens, temperature })
  );

  if (!res.ok) {
    const err = await res.json<{ error?: { message?: string } }>().catch(() => ({ error: undefined }));
    throw new Error(err?.error?.message ?? `GigaChat API: HTTP ${res.status}`);
  }

  const data = await res.json<{ choices: Array<{ message: { content: string } }> }>();
  return data.choices?.[0]?.message?.content ?? "";
}
