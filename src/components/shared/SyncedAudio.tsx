"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Play, Pause, Volume2, Upload, X, Plus, Music } from "lucide-react";

interface Track { url: string; title: string; }
type AudioEvent =
  | { type: "add";    track: Track }
  | { type: "remove"; url: string }
  | { type: "play";   url: string; time: number }
  | { type: "pause";  url: string; time: number }
  | { type: "seek";   time: number };

export default function SyncedAudio({ roomId, role }: { roomId: string; role: "tutor" | "student" }) {
  const audioRef    = useRef<HTMLAudioElement>(null);
  const channelRef  = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const ignoreRef   = useRef(false);

  const [tracks,    setTracks]    = useState<Track[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [urlInput,  setUrlInput]  = useState("");
  const [showAdd,   setShowAdd]   = useState(false);

  const isTutor = role === "tutor";

  // ── Realtime ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`audio-${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "audio" }, ({ payload }: { payload: AudioEvent }) => {
        const audio = audioRef.current;
        if (payload.type === "add")    { setTracks(t => t.find(x => x.url === payload.track.url) ? t : [...t, payload.track]); return; }
        if (payload.type === "remove") { setTracks(t => t.filter(x => x.url !== payload.url)); return; }
        if (!audio) return;
        if (payload.type === "play") {
          ignoreRef.current = true;
          setActiveUrl(payload.url);
          if (audio.src !== payload.url) audio.src = payload.url;
          audio.currentTime = payload.time;
          audio.play().catch(() => {}); setPlaying(true);
          setTimeout(() => { ignoreRef.current = false; }, 200);
        }
        if (payload.type === "pause") {
          ignoreRef.current = true;
          if (payload.time != null) audio.currentTime = payload.time;
          audio.pause(); setPlaying(false);
          setTimeout(() => { ignoreRef.current = false; }, 200);
        }
        if (payload.type === "seek") {
          ignoreRef.current = true;
          audio.currentTime = payload.time;
          setTimeout(() => { ignoreRef.current = false; }, 200);
        }
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  const send = (p: AudioEvent) =>
    channelRef.current?.send({ type: "broadcast", event: "audio", payload: p });

  // ── actions ───────────────────────────────────────────────────────────────────
  const addTrack = (url: string, title: string) => {
    if (!url.trim()) return;
    const track: Track = { url: url.trim(), title: title.trim() || url.split("/").pop() || "Аудио" };
    setTracks(t => t.find(x => x.url === track.url) ? t : [...t, track]);
    send({ type: "add", track });
    setUrlInput(""); setShowAdd(false);
  };

  const removeTrack = (url: string) => {
    setTracks(t => t.filter(x => x.url !== url));
    if (activeUrl === url) { audioRef.current?.pause(); setActiveUrl(null); setPlaying(false); }
    send({ type: "remove", url });
  };

  const playTrack = (track: Track) => {
    const audio = audioRef.current;
    if (!audio || !isTutor) return;
    const isActive = activeUrl === track.url;
    if (isActive && playing) {
      audio.pause(); setPlaying(false);
      send({ type: "pause", url: track.url, time: audio.currentTime });
    } else {
      if (!isActive) { setActiveUrl(track.url); audio.src = track.url; audio.currentTime = 0; setCurrent(0); setDuration(0); }
      audio.play().catch(() => {}); setPlaying(true);
      send({ type: "play", url: track.url, time: isActive ? audio.currentTime : 0 });
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isTutor) return;
    const t = +e.target.value;
    if (audioRef.current) audioRef.current.currentTime = t;
    setCurrent(t);
    send({ type: "seek", time: t });
  };

  const onTimeUpdate = () => {
    if (!ignoreRef.current) setCurrent(audioRef.current?.currentTime ?? 0);
  };

  const onEnded = () => { setPlaying(false); };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const activeTrack = tracks.find(t => t.url === activeUrl) ?? null;

  if (tracks.length === 0 && !isTutor) return null;

  return (
    <div className="border-t shrink-0 flex flex-col" style={{ borderColor: "var(--brown-pale)", background: "white", maxHeight: 240 }}>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        onEnded={onEnded} />

      {/* Active player */}
      {activeTrack && (
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: "var(--brown-pale)" }}>
          <Music size={13} style={{ color: "var(--brown-light)", flexShrink: 0 }} />
          <span className="text-xs font-medium truncate flex-1" style={{ color: "var(--brown-dark)" }}>{activeTrack.title}</span>
          <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--brown-mid)" }}>{fmt(current)}</span>
          <input type="range" min={0} max={duration || 100} step={0.5} value={current}
            onChange={onSeek} disabled={!isTutor}
            className="w-28 accent-amber-700 h-1 cursor-pointer shrink-0"
            style={{ opacity: isTutor ? 1 : 0.7 }} />
          <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--brown-light)" }}>{fmt(duration)}</span>
          {!isTutor && <span className="text-xs shrink-0" style={{ color: "var(--brown-light)" }}>🎵 синхронно</span>}
        </div>
      )}

      {/* Playlist */}
      <div className="overflow-y-auto flex-1">
        {tracks.length === 0 && isTutor && (
          <div className="px-3 py-2 text-xs" style={{ color: "var(--brown-light)" }}>
            Добавь аудиофайл — он появится у ученика синхронно
          </div>
        )}
        {tracks.map(track => {
          const isActive  = track.url === activeUrl;
          const isPlaying = isActive && playing;
          return (
            <div key={track.url} className="flex items-center gap-2 px-2 py-1.5 border-b last:border-0"
              style={{ borderColor: "var(--brown-pale)", background: isActive ? "#fdf8f0" : "white" }}>
              <button onClick={() => playTrack(track)} disabled={!isTutor}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white transition-all"
                style={{ background: isActive ? "var(--gradient-primary)" : "var(--brown-pale)", opacity: isTutor ? 1 : 0.6 }}
                title={isTutor ? undefined : "Управляет репетитор"}>
                {isPlaying ? <Pause size={12}/> : <Play size={12} style={{ color: isActive ? "white" : "var(--brown-mid)" }}/>}
              </button>
              <span className="text-xs flex-1 truncate" style={{ color: "var(--brown-dark)", fontWeight: isActive ? 500 : 400 }}>
                {track.title}
              </span>
              {isTutor && (
                <button onClick={() => removeTrack(track.url)}
                  className="shrink-0 p-0.5 rounded hover:opacity-60 transition-all"
                  style={{ color: "var(--brown-light)" }}>
                  <X size={13}/>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add track (tutor only) */}
      {isTutor && (
        <div className="px-2 py-1.5 border-t" style={{ borderColor: "var(--brown-pale)" }}>
          {showAdd ? (
            <div className="flex items-center gap-1.5">
              <Volume2 size={13} style={{ color: "var(--brown-light)", flexShrink: 0 }} />
              <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addTrack(urlInput, "")}
                placeholder="URL (.mp3, .m4a...)"
                autoFocus
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border outline-none"
                style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }} />
              <label className="shrink-0 flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                style={{ background: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                <Upload size={12}/> Файл
                <input type="file" accept="audio/*" className="hidden" onChange={e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  addTrack(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ""));
                }} />
              </label>
              <button onClick={() => setShowAdd(false)} className="shrink-0 p-1 rounded hover:opacity-60" style={{ color: "var(--brown-light)" }}>
                <X size={13}/>
              </button>
            </div>
          ) : (
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg hover:opacity-80 transition-all w-full"
              style={{ color: "var(--brown-mid)" }}>
              <Plus size={13}/> Добавить аудио
            </button>
          )}
        </div>
      )}
    </div>
  );
}
