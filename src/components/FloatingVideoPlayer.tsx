"use client";

import { useState, useRef, useCallback } from "react";
import YoutubeAutoplayFrame from "@/components/YoutubeAutoplayFrame";
import { isYoutubeUrl } from "@/lib/youtube";

interface FloatingVideoPlayerProps {
  videoUrl: string;
  title: string;
  onClose: () => void;
  initialPosition?: { x: number; y: number };
}

export default function FloatingVideoPlayer({
  videoUrl,
  title,
  onClose,
  initialPosition = { x: 40, y: 120 },
}: FloatingVideoPlayerProps) {
  const [pos, setPos] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 420, height: 260 });
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    const rect = containerRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    // keep on screen
    const maxX = window.innerWidth - size.width - 20;
    const maxY = window.innerHeight - size.height - 20;
    setPos({
      x: Math.max(10, Math.min(newX, maxX)),
      y: Math.max(10, Math.min(newY, maxY)),
    });
  }, [isDragging, dragOffset, size]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // attach global listeners when dragging
  if (typeof window !== "undefined") {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
  }

  const toggleSize = () => {
    if (size.width > 320) {
      setSize({ width: 320, height: 200 });
    } else {
      setSize({ width: 420, height: 260 });
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed z-[100] shadow-2xl rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)]"
      style={{
        left: pos.x,
        top: pos.y,
        width: size.width,
        height: size.height,
        cursor: isDragging ? "grabbing" : "default",
      }}
    >
      {/* Drag handle / title bar */}
      <div
        className="flex items-center justify-between bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-accent">▶</span>
          <span className="truncate" title={title}>{title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={toggleSize}
            className="px-1.5 py-0.5 text-[10px] hover:bg-[var(--surface)] rounded"
            title="Resize video"
          >
            {size.width > 320 ? "–" : "+"}
          </button>
          <button
            onClick={onClose}
            className="px-1.5 py-0.5 hover:bg-[var(--surface)] rounded text-[var(--muted)] hover:text-[var(--text)]"
            title="Close floating player"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Video iframe */}
      <div className="relative bg-black" style={{ height: "calc(100% - 32px)" }}>
        {isYoutubeUrl(videoUrl) ? (
          <YoutubeAutoplayFrame
            videoUrl={videoUrl}
            title={title}
            className="absolute inset-0 h-full w-full"
            autoplay
            kickPlayback
            duckBackgroundMusic
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--muted)] text-sm">
            Video unavailable
          </div>
        )}
      </div>

      <div className="absolute bottom-1 right-1 text-[9px] text-[var(--muted)]/70 bg-[var(--surface)]/80 px-1 rounded">
        Drag title bar
      </div>
    </div>
  );
}
