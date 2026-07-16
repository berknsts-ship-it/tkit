import { createHmac } from "crypto";

export function signUploadToken(userId: string, uploadPath: string): string {
  const exp = (Date.now() + 15 * 60 * 1000).toString();
  const userB64 = Buffer.from(userId).toString("base64url");
  const pathB64 = Buffer.from(uploadPath).toString("base64url");
  const body = `${exp}.${userB64}.${pathB64}`;
  const mac = createHmac("sha256", process.env.CRON_SECRET!).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyUploadToken(token: string): { userId: string; uploadPath: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 4) return null;
    const [exp, userB64, pathB64, mac] = parts;
    const body = `${exp}.${userB64}.${pathB64}`;
    const expected = createHmac("sha256", process.env.CRON_SECRET!).update(body).digest("base64url");
    if (mac !== expected) return null;
    if (Date.now() > parseInt(exp)) return null;
    return {
      userId: Buffer.from(userB64, "base64url").toString(),
      uploadPath: Buffer.from(pathB64, "base64url").toString(),
    };
  } catch {
    return null;
  }
}
