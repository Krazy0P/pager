"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";

// Deterministic waveform heights based on audio url or index
function generateWaveformBars(seed: string, count = 28): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    const val = Math.abs(Math.sin((hash + i * 13) * 0.25) * 80 + 20);
    bars.push(Math.round(val));
  }
  return bars;
}

function formatDuration(seconds: number) {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function VoiceMessagePlayer({
  src,
  mine,
}: {
  src: string;
  mine?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const bars = useRef(generateWaveformBars(src)).current;

  useEffect(() => {
    const audio = new Audio(src);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const seek = (ratio: number) => {
    if (!audioRef.current || !duration) return;
    audioRef.current.currentTime = ratio * duration;
    setCurrentTime(audioRef.current.currentTime);
  };

  const progressRatio = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex items-center gap-3 py-1 pr-1 min-w-[200px] max-w-[280px]">
      <button
        type="button"
        onClick={togglePlay}
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded transition-colors",
          mine
            ? "bg-primary-foreground/20 hover:bg-primary-foreground/30 text-primary-foreground"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
        aria-label={isPlaying ? "Pause" : "Play voice note"}
      >
        {isPlaying ? <Pause className="size-4" /> : <Play className="size-4 ml-0.5" />}
      </button>

      <div className="flex flex-1 flex-col justify-center gap-1 min-w-0">
        <div
          className="flex h-6 items-center gap-0.5 cursor-pointer py-1"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            seek(clickRatio);
          }}
        >
          {bars.map((height, i) => {
            const barRatio = i / bars.length;
            const isPlayed = barRatio <= progressRatio;
            return (
              <span
                key={i}
                style={{ height: `${height}%` }}
                className={cn(
                  "w-[3px] rounded-full transition-colors",
                  mine
                    ? isPlayed
                      ? "bg-primary-foreground"
                      : "bg-primary-foreground/35"
                    : isPlayed
                      ? "bg-primary"
                      : "bg-muted-foreground/30",
                )}
              />
            );
          })}
        </div>

        <div
          className={cn(
            "text-xs tabular-nums leading-none",
            mine ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {formatDuration(isPlaying ? currentTime : duration || 0)}
        </div>
      </div>
    </div>
  );
}
