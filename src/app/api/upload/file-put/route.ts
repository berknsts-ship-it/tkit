import { NextRequest, NextResponse } from "next/server";
import { verifyUploadToken } from "@/lib/upload-token";
import { mkdir } from "fs/promises";
import { createWriteStream } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import nodePath from "path";

export const runtime = "nodejs";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "/var/www/uploads";

export async function PUT(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 401 });

  const payload = verifyUploadToken(token);
  if (!payload) return NextResponse.json({ error: "Invalid or expired token" }, { status: 401 });

  const { uploadPath } = payload;
  const filePath = nodePath.resolve(UPLOAD_DIR, uploadPath);

  // Prevent path traversal
  if (!filePath.startsWith(nodePath.resolve(UPLOAD_DIR))) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  await mkdir(nodePath.dirname(filePath), { recursive: true });

  if (!req.body) return NextResponse.json({ error: "No body" }, { status: 400 });

  const writable = createWriteStream(filePath);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await pipeline(Readable.fromWeb(req.body as any), writable);

  return NextResponse.json({ ok: true });
}
