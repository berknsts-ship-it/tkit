"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Download } from "lucide-react";
import dynamic from "next/dynamic";
const FlvPlayer = dynamic(() => import("@/components/shared/FlvPlayer"), { ssr: false });

interface Material {
  id: string;
  title: string;
  file_url: string | null;
  file_name: string | null;
}

function getFileType(fileName: string | null) {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext ?? "")) return "image";
  if (["mp4", "webm", "mov", "m4v", "avi"].includes(ext ?? "")) return "video";
  if (ext === "flv") return "flv";
  if (["mp3", "m4a", "wav", "ogg", "aac"].includes(ext ?? "")) return "audio";
  if (["doc", "docx"].includes(ext ?? "")) return "doc";
  return "other";
}

function getEmoji(type: string) {
  if (type === "pdf") return "📄";
  if (type === "image") return "🖼️";
  if (type === "video" || type === "flv") return "🎬";
  if (type === "audio") return "🎵";
  if (type === "doc") return "📝";
  return "📎";
}

const cardStyle = {
  background: "white",
  borderColor: "var(--brown-pale)",
  boxShadow: "var(--shadow-card)",
};

export default function StudentMaterials({ materials }: { materials: Material[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Учебники и материалы</h2>
      <div className="space-y-2">
        {materials.map(m => {
          const type = getFileType(m.file_name);
          const isOpen = openId === m.id;

          return (
            <div key={m.id} className="rounded-xl border overflow-hidden" style={cardStyle}>
              {/* Заголовок карточки */}
              <button
                onClick={() => setOpenId(isOpen ? null : m.id)}
                className="w-full flex items-center gap-4 p-4 text-left hover:opacity-80 transition-all"
              >
                <span className="text-2xl shrink-0">{getEmoji(type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium" style={{ color: "var(--brown-dark)" }}>{m.title}</div>
                  {m.file_name && (
                    <div className="text-xs mt-0.5 truncate" style={{ color: "var(--brown-light)" }}>
                      {m.file_name}
                    </div>
                  )}
                </div>
                <span style={{ color: "var(--brown-light)" }}>
                  {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </span>
              </button>

              {/* Встроенный просмотрщик */}
              {isOpen && m.file_url && (
                <div className="border-t" style={{ borderColor: "var(--brown-pale)" }}>
                  {type === "pdf" && (
                    <iframe
                      src={m.file_url!}
                      className="w-full"
                      style={{ height: "75vh", display: "block" }}
                      title={m.title}
                    />
                  )}

                  {type === "image" && (
                    <div className="p-4 flex items-center justify-center bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={m.file_url}
                        alt={m.title}
                        className="max-w-full rounded-lg"
                        style={{ maxHeight: "70vh", objectFit: "contain" }}
                      />
                    </div>
                  )}

                  {type === "video" && (
                    <div className="p-2 bg-black flex items-center justify-center">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video src={m.file_url!} controls className="w-full rounded-lg"
                        style={{ maxHeight: "70vh" }} />
                    </div>
                  )}

                  {type === "flv" && (
                    <div className="p-2 bg-black">
                      <FlvPlayer src={m.file_url!} />
                    </div>
                  )}

                  {type === "audio" && (
                    <div className="p-4 flex items-center justify-center">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <audio src={m.file_url} controls className="w-full" />
                    </div>
                  )}

                  {(type === "doc" || type === "other") && (
                    <div className="p-6 flex flex-col items-center gap-4 text-center">
                      <p className="text-sm" style={{ color: "var(--brown-mid)" }}>
                        {type === "doc"
                          ? "Word-документы нельзя открыть прямо здесь — скачай файл"
                          : "Этот тип файла нельзя показать в браузере — скачай файл"}
                      </p>
                      <a
                        href={m.file_url}
                        download={m.file_name ?? undefined}
                        className="flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-white"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <Download size={16} />
                        Скачать
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
