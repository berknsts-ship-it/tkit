"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";
const FlvPlayer = dynamic(() => import("@/components/shared/FlvPlayer"), { ssr: false });

function Viewer() {
  const params = useSearchParams();
  const url = params.get("url");
  const name = params.get("name") ?? "Файл";

  if (!url) return <p style={{ color: "var(--brown-mid)" }}>Файл не найден</p>;

  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext ?? "");
  const isPdf = ext === "pdf";
  const isVideo = ["mp4", "webm", "mov", "m4v"].includes(ext ?? "");
  const isFlv   = ext === "flv";
  const isAudio = ["mp3", "m4a", "wav", "ogg", "aac"].includes(ext ?? "");

  return (
    <div className="flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-lg font-semibold truncate" style={{ color: "var(--brown-dark)" }}>{name}</h1>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 text-sm px-3 py-1 rounded-lg border hover:opacity-70 transition-all"
          style={{ borderColor: "var(--brown-pale)", color: "var(--brown-mid)" }}>
          Открыть оригинал ↗
        </a>
      </div>

      {isPdf && (
        <iframe
          src={url}
          className="flex-1 w-full rounded-xl border"
          style={{ borderColor: "var(--brown-pale)", minHeight: 0 }}
        />
      )}

      {isImage && (
        <div className="flex-1 flex items-center justify-center overflow-auto rounded-xl border p-4"
          style={{ borderColor: "var(--brown-pale)", background: "white" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={name} className="max-w-full max-h-full object-contain" />
        </div>
      )}

      {isVideo && (
        <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={url} controls className="max-w-full max-h-full" style={{ maxHeight: "calc(100vh - 120px)" }} />
        </div>
      )}

      {isFlv && (
        <div className="flex-1 flex items-center justify-center bg-black rounded-xl overflow-hidden p-2">
          <FlvPlayer src={url} />
        </div>
      )}

      {isAudio && (
        <div className="flex-1 flex items-center justify-center">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio src={url} controls className="w-full max-w-lg" />
        </div>
      )}

      {!isPdf && !isImage && !isVideo && !isFlv && !isAudio && (
        <div className="flex-1 flex flex-col items-center justify-center rounded-xl border gap-4"
          style={{ borderColor: "var(--brown-pale)", background: "white" }}>
          <div className="text-6xl">📎</div>
          <p className="font-medium" style={{ color: "var(--brown-dark)" }}>{name}</p>
          <p className="text-sm" style={{ color: "var(--brown-light)" }}>
            Этот тип файла нельзя просмотреть прямо здесь
          </p>
          <a href={url} download
            className="px-5 py-2 rounded-xl font-semibold text-white"
            style={{ background: "var(--gradient-primary)" }}>
            Скачать
          </a>
        </div>
      )}
    </div>
  );
}

export default function MaterialViewPage() {
  return (
    <Suspense>
      <Viewer />
    </Suspense>
  );
}
