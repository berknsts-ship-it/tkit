"use client";

import { useEffect, useRef } from "react";

export default function FlvPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let player: { destroy(): void } | null = null;

    async function init() {
      const flvjs = (await import("flv.js")).default;
      if (!flvjs.isSupported() || !videoRef.current) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      player = flvjs.createPlayer({ type: "flv", url: src }) as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (player as any).attachMediaElement(videoRef.current);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (player as any).load();
    }

    init();
    return () => { player?.destroy(); };
  }, [src]);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video ref={videoRef} controls className="w-full rounded-lg"
      style={{ maxHeight: "70vh", background: "#000" }} />
  );
}
