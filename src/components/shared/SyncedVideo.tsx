"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Play, Pause, Upload, X, Plus, Video, ChevronDown, ChevronUp } from "lucide-react";

interface Track { url: string; title: string; }
type VideoEvent =
  | { type: "add";    track: Track }
  | { type: "remove"; url: string }
  | { type: "open" }
  | { type: "play";   url: string; time: number }
  | { type: "pause";  url: string; time: number }
  | { type: "seek";   time: number };

export default function SyncedVideo({ roomId, role }: { roomId: string; role: "tutor" | "student" }) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
  const ignoreRef  = useRef(false);

  const [tracks,    setTracks]    = useState<Track[]>([]);
  const [activeUrl, setActiveUrl] = useState<string | null>(null);
  const [playing,   setPlaying]   = useState(false);
  const [current,   setCurrent]   = useState(0);
  const [duration,  setDuration]  = useState(0);
  const [expanded,  setExpanded]  = useState(false);
  const [showAdd,   setShowAdd]   = useState(false);
  const [urlInput,  setUrlInput]  = useState("");

  const isTutor = role === "tutor";

  // ── Realtime ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase
      .channel(`video-${roomId}`, { config: { broadcast: { self: false } } })
      .on("broadcast", { event: "video" }, ({ payload }: { payload: VideoEvent }) => {
        const video = videoRef.current;
        if (payload.type === "add")  { setTracks(t => t.find(x => x.url === payload.track.url) ? t : [...t, payload.track]); return; }
        if (payload.type === "remove") { setTracks(t => t.filter(x => x.url !== payload.url)); return; }
        if (payload.type === "open") { setExpanded(true); return; }
        if (!video) return;
        if (payload.type === "play") {
          ignoreRef.current = true;
          if (video.src !== payload.url) { setActiveUrl(payload.url); video.src = payload.url; }
          video.currentTime = payload.time;
          video.play().catch(() => {}); setPlaying(true); setExpanded(true);
          setTimeout(() => { ignoreRef.current = false; }, 200);
        }
        if (payload.type === "pause") {
          ignoreRef.current = true;
          if (payload.time != null) video.currentTime = payload.time;
          video.pause(); setPlaying(false);
          setTimeout(() => { ignoreRef.current = false; }, 200);
        }
        if (payload.type === "seek") {
          ignoreRef.current = true;
          video.currentTime = payload.time;
          setTimeout(() => { ignoreRef.current = false; }, 200);
        }
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  const send = (p: VideoEvent) =>
    channelRef.current?.send({ type: "broadcast", event: "video", payload: p });

  // ── actions ───────────────────────────────────────────────────────────────────
  const addTrack = (url: string, title: string) => {
    if (!url.trim()) return;
    const track: Track = { url: url.trim(), title: title.trim() || url.split("/").pop()?.replace(/\?.*/, "") || "Видео" };
    setTracks(t => t.find(x => x.url === track.url) ? t : [...t, track]);
    send({ type: "add", track });
    setUrlInput(""); setShowAdd(false);
  };

  const removeTrack = (url: string) => {
    setTracks(t => t.filter(x => x.url !== url));
    if (activeUrl === url) { videoRef.current?.pause(); setActiveUrl(null); setPlaying(false); }
    send({ type: "remove", url });
  };

  const playTrack = (track: Track) => {
    const video = videoRef.current;
    if (!video || !isTutor) return;
    const isActive = activeUrl === track.url;
    if (isActive && playing) {
      video.pause(); setPlaying(false);
      send({ type: "pause", url: track.url, time: video.currentTime });
    } else {
      if (!isActive) { setActiveUrl(track.url); video.src = track.url; video.currentTime = 0; setCurrent(0); setDuration(0); }
      video.play().catch(() => {}); setPlaying(true);
      send({ type: "play", url: track.url, time: isActive ? video.currentTime : 0 });
    }
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isTutor) return;
    const t = +e.target.value;
    if (videoRef.current) videoRef.current.currentTime = t;
    setCurrent(t); send({ type: "seek", time: t });
  };

  const onTimeUpdate = () => { if (!ignoreRef.current) setCurrent(videoRef.current?.currentTime ?? 0); };
  const onEnded      = () => setPlaying(false);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const activeTrack = tracks.find(t => t.url === activeUrl) ?? null;

  const toggleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && isTutor) send({ type: "open" });
  };

  if (tracks.length === 0 && !isTutor) return null;

  return (
    <div className="border-t shrink-0 flex flex-col" style={{ borderColor: "var(--brown-pale)", background: "white" }}>
      {/* Header / toggle */}
      <button onClick={toggleExpand}
        className="flex items-center gap-2 px-3 py-2 w-full text-left hover:opacity-80 transition-all shrink-0">
        <Video size={14} style={{ color: "var(--brown-mid)", flexShrink: 0 }} />
        <span className="text-xs font-medium flex-1" style={{ color: "var(--brown-dark)" }}>
          Видео {tracks.length > 0 && `(${tracks.length})`}
          {activeTrack && playing && <span className="ml-1.5 text-green-600">▶ {activeTrack.title}</span>}
        </span>
        {!isTutor && <span className="text-xs" style={{ color: "var(--brown-light)" }}>🎬 синхронно</span>}
        {expanded
          ? <ChevronDown size={13} style={{ color: "var(--brown-light)", flexShrink: 0 }} />
          : <ChevronUp   size={13} style={{ color: "var(--brown-light)", flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div className="flex flex-col border-t" style={{ borderColor: "var(--brown-pale)" }}>
          {/* Video player */}
          <div className="flex gap-3 px-3 pt-2 pb-2" style={{ minHeight: activeTrack ? 180 : 0 }}>
            <div className="relative rounded-xl overflow-hidden bg-black shrink-0"
              style={{ width: activeTrack ? 260 : 0, aspectRatio: "16/9", display: activeTrack ? "block" : "none" }}>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="w-full h-full object-contain"
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
                onEnded={onEnded} />
            </div>

            {/* Playlist */}
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 200 }}>
              {tracks.length === 0 && isTutor && (
                <div className="text-xs py-2" style={{ color: "var(--brown-light)" }}>
                  Добавь видеофайл — он появится у ученика синхронно
                </div>
              )}
              {tracks.map(track => {
                const isActive  = track.url === activeUrl;
                const isPlaying = isActive && playing;
                return (
                  <div key={track.url} className="flex items-center gap-2 rounded-lg px-2 py-1.5 border"
                    style={{ borderColor: isActive ? "var(--brown-dark)" : "var(--brown-pale)",
                             background: isActive ? "var(--brown-pale)" : "white" }}>
                    <button onClick={() => playTrack(track)} disabled={!isTutor}
                      className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white"
                      style={{ background: isActive ? "var(--gradient-primary)" : "var(--brown-pale)",
                               opacity: isTutor ? 1 : 0.6 }}>
                      {isPlaying
                        ? <Pause size={11}/>
                        : <Play size={11} style={{ color: isActive ? "white" : "var(--brown-mid)" }}/>}
                    </button>
                    <span className="text-xs flex-1 truncate"
                      style={{ color: "var(--brown-dark)", fontWeight: isActive ? 500 : 400 }}>
                      {track.title}
                    </span>
                    {isTutor && (
                      <button onClick={() => removeTrack(track.url)}
                        className="shrink-0 p-0.5 rounded hover:opacity-60"
                        style={{ color: "var(--brown-light)" }}>
                        <X size={12}/>
                      </button>
                    )}
                  </div>
                );
              })}

              {/* Add track */}
              {isTutor && (
                showAdd ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input value={urlInput} onChange={e => setUrlInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && addTrack(urlInput, "")}
                      placeholder="URL (.mp4, .webm, .m4v...)"
                      autoFocus
                      className="flex-1 text-xs px-2 py-1.5 rounded-lg border outline-none"
                      style={{ borderColor: "var(--brown-pale)", color: "var(--brown-dark)" }} />
                    <label className="shrink-0 flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg cursor-pointer hover:opacity-80"
                      style={{ background: "var(--brown-pale)", color: "var(--brown-dark)" }}>
                      <Upload size={11}/> Файл
                      <input type="file" accept="video/*" className="hidden" onChange={e => {
                        const file = e.target.files?.[0]; if (!file) return;
                        addTrack(URL.createObjectURL(file), file.name.replace(/\.[^.]+$/, ""));
                      }} />
                    </label>
                    <button onClick={() => setShowAdd(false)} className="shrink-0 p-1 rounded hover:opacity-60"
                      style={{ color: "var(--brown-light)" }}>
                      <X size={12}/>
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setShowAdd(true)}
                    className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg hover:opacity-80 mt-0.5"
                    style={{ color: "var(--brown-mid)" }}>
                    <Plus size={12}/> Добавить видео
                  </button>
                )
              )}
            </div>
          </div>

          {/* Controls */}
          {activeTrack && (
            <div className="flex items-center gap-2 px-3 pb-2 border-t pt-2" style={{ borderColor: "var(--brown-pale)" }}>
              <button onClick={() => playTrack(activeTrack)} disabled={!isTutor}
                className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-white"
                style={{ background: "var(--gradient-primary)", opacity: isTutor ? 1 : 0.6 }}>
                {playing ? <Pause size={12}/> : <Play size={12}/>}
              </button>
              <span className="text-xs shrink-0 tabular-nums w-10 text-right" style={{ color: "var(--brown-mid)" }}>
                {fmt(current)}
              </span>
              <input type="range" min={0} max={duration || 100} step={0.5} value={current}
                onChange={onSeek} disabled={!isTutor}
                className="flex-1 accent-amber-700 h-1 cursor-pointer"
                style={{ opacity: isTutor ? 1 : 0.7 }} />
              <span className="text-xs shrink-0 tabular-nums w-10" style={{ color: "var(--brown-light)" }}>
                {fmt(duration)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
